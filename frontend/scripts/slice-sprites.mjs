import { mkdir } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const publicDirectory = join(scriptDirectory, '..', 'public', 'assets');
const sourceDirectory = join(scriptDirectory, '..', 'source-assets');
const poses = ['idle', 'windup', 'attack', 'hit', 'victory', 'defeat'];
const sheets = [
  ['lula', join(sourceDirectory, 'lula-fighter-spritesheet.png')],
  ['flavio', join(sourceDirectory, 'flavio-bolsonaro-fighter-spritesheet.png')],
];

function findComponents(data, width, height, channels) {
  const labels = new Int32Array(width * height);
  const components = [];
  let nextLabel = 0;

  for (let start = 0; start < labels.length; start += 1) {
    if (labels[start] !== 0 || data[start * channels + 3] <= 8) continue;

    nextLabel += 1;
    labels[start] = nextLabel;
    const stack = [start];
    const component = {
      label: nextLabel,
      area: 0,
      minX: width,
      maxX: 0,
      minY: height,
      maxY: 0,
      sumX: 0,
      sumY: 0,
    };

    while (stack.length > 0) {
      const pixel = stack.pop();
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      component.area += 1;
      component.sumX += x;
      component.sumY += y;
      component.minX = Math.min(component.minX, x);
      component.maxX = Math.max(component.maxX, x);
      component.minY = Math.min(component.minY, y);
      component.maxY = Math.max(component.maxY, y);

      const neighbors = [];
      if (x > 0) neighbors.push(pixel - 1);
      if (x + 1 < width) neighbors.push(pixel + 1);
      if (y > 0) neighbors.push(pixel - width);
      if (y + 1 < height) neighbors.push(pixel + width);

      for (const neighbor of neighbors) {
        if (labels[neighbor] === 0 && data[neighbor * channels + 3] > 8) {
          labels[neighbor] = nextLabel;
          stack.push(neighbor);
        }
      }
    }

    components.push(component);
  }

  return { labels, components };
}

async function sliceSheet(candidate, inputPath) {
  const { data, info } = await sharp(inputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { labels, components } = findComponents(data, info.width, info.height, info.channels);
  const mainComponents = components
    .filter((component) => component.area > 1_000)
    .sort((a, b) => b.area - a.area)
    .slice(0, poses.length)
    .sort((a, b) => a.sumX / a.area - b.sumX / b.area);

  if (mainComponents.length !== poses.length) {
    throw new Error(`${basename(inputPath)}: esperados 6 personagens, encontrados ${mainComponents.length}`);
  }

  const groupByLabel = new Map();
  for (const component of components) {
    const centerX = component.sumX / component.area;
    const centerY = component.sumY / component.area;
    let nearestGroup = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (let group = 0; group < mainComponents.length; group += 1) {
      const main = mainComponents[group];
      const mainX = main.sumX / main.area;
      const mainY = main.sumY / main.area;
      const distance = (centerX - mainX) ** 2 * 2.5 + (centerY - mainY) ** 2;
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestGroup = group;
      }
    }
    groupByLabel.set(component.label, nearestGroup);
  }

  const boxes = mainComponents.map(() => ({ minX: info.width, maxX: 0 }));
  for (const component of components) {
    const group = groupByLabel.get(component.label);
    boxes[group].minX = Math.min(boxes[group].minX, component.minX);
    boxes[group].maxX = Math.max(boxes[group].maxX, component.maxX);
  }

  const targetWidth = Math.max(...boxes.map((box) => box.maxX - box.minX + 1)) + 24;
  const outputDirectory = join(publicDirectory, 'fighters', candidate);
  await mkdir(outputDirectory, { recursive: true });

  for (let index = 0; index < poses.length; index += 1) {
    const box = boxes[index];
    const width = box.maxX - box.minX + 1;
    const offsetX = Math.floor((targetWidth - width) / 2) - box.minX;
    const output = Buffer.alloc(targetWidth * info.height * 4);

    for (let pixel = 0; pixel < labels.length; pixel += 1) {
      const label = labels[pixel];
      if (label === 0 || groupByLabel.get(label) !== index) continue;
      const sourceX = pixel % info.width;
      const sourceY = Math.floor(pixel / info.width);
      const targetX = sourceX + offsetX;
      const targetPixel = (sourceY * targetWidth + targetX) * 4;
      const sourcePixel = pixel * info.channels;
      data.copy(output, targetPixel, sourcePixel, sourcePixel + 4);
    }

    await sharp(output, { raw: { width: targetWidth, height: info.height, channels: 4 } })
      .png()
      .toFile(join(outputDirectory, `${poses[index]}.png`));
  }

  console.log(`${candidate}: ${poses.length} quadros em ${targetWidth}x${info.height}`);
}

for (const [candidate, inputPath] of sheets) {
  await sliceSheet(candidate, inputPath);
}
