import { connectorGeometry } from './connectorGeometry';
// =============================================================================
// Export Engine - PNG, SVG, PDF export from DiagramData
// =============================================================================

import type {
  DiagramData,
  DiagramElement,
  Connector,
  ExportOptions,
} from '../types';

const DEFAULT_OPTIONS: Required<ExportOptions> = {
  scale: 2,
  backgroundColor: '#ffffff',
  padding: 20,
};

function resolveOptions(options?: ExportOptions): Required<ExportOptions> {
  return { ...DEFAULT_OPTIONS, ...options };
}

/**
 * Compute bounding box of all elements in the diagram.
 */
function computeBounds(diagram: DiagramData): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  if (diagram.elements.length === 0) {
    return { minX: 0, minY: 0, maxX: 200, maxY: 200, width: 200, height: 200 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of diagram.elements) {
    minX = Math.min(minX, el.position.x);
    minY = Math.min(minY, el.position.y);
    maxX = Math.max(maxX, el.position.x + el.size.width);
    maxY = Math.max(maxY, el.position.y + el.size.height);
  }
  diagram.connectors.forEach((connector, index) => {
    const geometry = connectorGeometry(connector, diagram.elements, diagram.type === 'sequence' ? index : undefined);
    if (!geometry) return;
    for (const point of [geometry.source, ...geometry.waypoints, geometry.target]) {
      minX = Math.min(minX, point.x); minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x); maxY = Math.max(maxY, point.y);
    }
  });
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

// =============================================================================
// SVG Generation
// =============================================================================

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function renderElementSVG(el: DiagramElement, offsetX: number, offsetY: number): string {
  const x = el.position.x - offsetX;
  const y = el.position.y - offsetY;
  const { width, height } = el.size;
  const name = escapeXml(el.properties.name);

  switch (el.type) {
    case 'lifeline':
      return `<rect x="${x}" y="${y}" width="${width}" height="40" fill="#f1f8e9" stroke="#333" />
        <text x="${x + width / 2}" y="${y + 24}" text-anchor="middle" font-size="12">${name}</text>
        <line x1="${x + width / 2}" y1="${y + 40}" x2="${x + width / 2}" y2="${y + height}" stroke="#333" stroke-dasharray="7,5" />`;
    case 'class':
    case 'abstract-class':
    case 'interface':
    case 'enum': {
      const lines: string[] = [];
      lines.push(`<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#ffffcc" stroke="#333" stroke-width="1" rx="2" />`);
      // Header
      const headerH = 28;
      lines.push(`<line x1="${x}" y1="${y + headerH}" x2="${x + width}" y2="${y + headerH}" stroke="#333" stroke-width="1" />`);
      const stereotype = el.type === 'interface' ? '«interface»' : el.type === 'abstract-class' ? '«abstract»' : el.type === 'enum' ? '«enum»' : '';
      if (stereotype) {
        lines.push(`<text x="${x + width / 2}" y="${y + 11}" text-anchor="middle" font-size="9" fill="#666">${escapeXml(stereotype)}</text>`);
        lines.push(`<text x="${x + width / 2}" y="${y + 23}" text-anchor="middle" font-size="11" font-weight="bold">${name}</text>`);
      } else {
        lines.push(`<text x="${x + width / 2}" y="${y + 18}" text-anchor="middle" font-size="11" font-weight="bold">${name}</text>`);
      }
      // Attributes
      const attrs = el.properties.attributes ?? [];
      let attrY = y + headerH + 14;
      for (const attr of attrs) {
        const vis = attr.visibility === 'public' ? '+' : attr.visibility === 'private' ? '-' : '#';
        lines.push(`<text x="${x + 4}" y="${attrY}" font-size="10">${escapeXml(`${vis} ${attr.name}: ${attr.type}`)}</text>`);
        attrY += 14;
      }
      // Methods
      const methods = el.properties.methods ?? [];
      if (attrs.length > 0 && methods.length > 0) {
        lines.push(`<line x1="${x}" y1="${attrY - 6}" x2="${x + width}" y2="${attrY - 6}" stroke="#333" stroke-width="0.5" />`);
      }
      for (const m of methods) {
        const vis = m.visibility === 'public' ? '+' : m.visibility === 'private' ? '-' : '#';
        lines.push(`<text x="${x + 4}" y="${attrY}" font-size="10">${escapeXml(`${vis} ${m.name}(${m.parameters.map((p) => `${p.name}: ${p.type}`).join(', ')}): ${m.returnType}`)}</text>`);
        attrY += 14;
      }
      return lines.join('\n');
    }
    case 'actor':
      return [
        `<circle cx="${x + width / 2}" cy="${y + 12}" r="10" fill="none" stroke="#333" stroke-width="1.5" />`,
        `<line x1="${x + width / 2}" y1="${y + 22}" x2="${x + width / 2}" y2="${y + 42}" stroke="#333" stroke-width="1.5" />`,
        `<line x1="${x + width / 2 - 14}" y1="${y + 30}" x2="${x + width / 2 + 14}" y2="${y + 30}" stroke="#333" stroke-width="1.5" />`,
        `<line x1="${x + width / 2}" y1="${y + 42}" x2="${x + width / 2 - 10}" y2="${y + 56}" stroke="#333" stroke-width="1.5" />`,
        `<line x1="${x + width / 2}" y1="${y + 42}" x2="${x + width / 2 + 10}" y2="${y + 56}" stroke="#333" stroke-width="1.5" />`,
        `<text x="${x + width / 2}" y="${y + height - 2}" text-anchor="middle" font-size="10">${name}</text>`,
      ].join('\n');
    case 'usecase':
      return [
        `<ellipse cx="${x + width / 2}" cy="${y + height / 2}" rx="${width / 2}" ry="${height / 2}" fill="#e8f5e9" stroke="#333" stroke-width="1" />`,
        `<text x="${x + width / 2}" y="${y + height / 2 + 4}" text-anchor="middle" font-size="10">${name}</text>`,
      ].join('\n');
    case 'state':
    case 'composite-state':
      return [
        `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#e3f2fd" stroke="#333" stroke-width="1" rx="10" />`,
        `<text x="${x + width / 2}" y="${y + height / 2 + 4}" text-anchor="middle" font-size="11">${name}</text>`,
      ].join('\n');
    case 'initial-state':
    case 'initial-node':
      return `<circle cx="${x + width / 2}" cy="${y + height / 2}" r="${Math.min(width, height) / 2}" fill="#333" />`;
    case 'final-state':
    case 'final-node':
      return [
        `<circle cx="${x + width / 2}" cy="${y + height / 2}" r="${Math.min(width, height) / 2}" fill="none" stroke="#333" stroke-width="2" />`,
        `<circle cx="${x + width / 2}" cy="${y + height / 2}" r="${Math.min(width, height) / 2 - 4}" fill="#333" />`,
      ].join('\n');
    case 'action':
      return [
        `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#fff3e0" stroke="#333" stroke-width="1" rx="8" />`,
        `<text x="${x + width / 2}" y="${y + height / 2 + 4}" text-anchor="middle" font-size="10">${name}</text>`,
      ].join('\n');
    case 'decision':
      return [
        `<polygon points="${x + width / 2},${y} ${x + width},${y + height / 2} ${x + width / 2},${y + height} ${x},${y + height / 2}" fill="#fff9c4" stroke="#333" stroke-width="1" />`,
        `<text x="${x + width / 2}" y="${y + height / 2 + 4}" text-anchor="middle" font-size="10">${name}</text>`,
      ].join('\n');
    case 'fork':
    case 'join':
      return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#333" />`;
    case 'system-boundary':
      return [
        `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="none" stroke="#333" stroke-width="1" stroke-dasharray="4,2" />`,
        `<text x="${x + width / 2}" y="${y + 16}" text-anchor="middle" font-size="11" font-weight="bold">${name}</text>`,
      ].join('\n');
    case 'note':
      return [
        `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#fff8e1" stroke="#999" stroke-width="1" />`,
        `<text x="${x + 4}" y="${y + 14}" font-size="10">${name}</text>`,
      ].join('\n');
    case 'package':
      return [
        `<rect x="${x}" y="${y}" width="${width * 0.4}" height="14" fill="#e0e0e0" stroke="#333" stroke-width="1" />`,
        `<rect x="${x}" y="${y + 14}" width="${width}" height="${height - 14}" fill="#fafafa" stroke="#333" stroke-width="1" />`,
        `<text x="${x + 6}" y="${y + 28}" font-size="11" font-weight="bold">${name}</text>`,
      ].join('\n');
    default:
      return [
        `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#f5f5f5" stroke="#333" stroke-width="1" />`,
        `<text x="${x + width / 2}" y="${y + height / 2 + 4}" text-anchor="middle" font-size="10">${name}</text>`,
      ].join('\n');
  }
}

function renderConnectorSVG(conn: Connector, elements: DiagramElement[], offsetX: number, offsetY: number, sequenceIndex?: number): string {
  const source = elements.find((e) => e.id === conn.sourceId);
  const target = elements.find((e) => e.id === conn.targetId);
  if (!source || !target) return '';

  const geometry = connectorGeometry(conn, elements, sequenceIndex)!;
  const sx = geometry.source.x - offsetX, sy = geometry.source.y - offsetY;
  const tx = geometry.target.x - offsetX, ty = geometry.target.y - offsetY;

  const points: string[] = [`${sx},${sy}`];
  if (geometry.waypoints) {
    for (const wp of geometry.waypoints) {
      points.push(`${wp.x - offsetX},${wp.y - offsetY}`);
    }
  }
  points.push(`${tx},${ty}`);

  const isDashed = conn.properties.lineStyle === 'dashed' ||
    ['dependency', 'usage', 'realization', 'return-message', 'include', 'extend'].includes(conn.type);
  const dashAttr = isDashed ? ' stroke-dasharray="6,3"' : '';

  const marker = conn.type === 'association' ? ''
    : ['composition', 'aggregation'].includes(conn.type) ? ` marker-start="url(#${conn.type})"`
    : ` marker-end="url(#${['inheritance', 'realization'].includes(conn.type) ? 'triangle' : 'arrowhead'})"`;
  const lines: string[] = [];
  lines.push(`<polyline points="${points.join(' ')}" fill="none" stroke="#333" stroke-width="1"${dashAttr}${marker} />`);

  // Label
  if (conn.label) {
    const midX = (sx + tx) / 2;
    const midY = (sy + ty) / 2;
    lines.push(`<text x="${midX}" y="${midY - 4}" text-anchor="middle" font-size="9" fill="#555">${escapeXml(conn.label)}</text>`);
  }

  // Multiplicity labels
  if (conn.sourceMultiplicity) {
    lines.push(`<text x="${sx + 8}" y="${sy - 4}" font-size="8" fill="#666">${escapeXml(conn.sourceMultiplicity)}</text>`);
  }
  if (conn.targetMultiplicity) {
    lines.push(`<text x="${tx + 8}" y="${ty - 4}" font-size="8" fill="#666">${escapeXml(conn.targetMultiplicity)}</text>`);
  }

  return lines.join('\n');
}

function buildSVGString(diagram: DiagramData, options: Required<ExportOptions>): string {
  const bounds = computeBounds(diagram);
  const { padding, backgroundColor } = options;
  const svgWidth = bounds.width + padding * 2;
  const svgHeight = bounds.height + padding * 2;
  const offsetX = bounds.minX - padding;
  const offsetY = bounds.minY - padding;

  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">`);
  parts.push(`<defs><marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#333" /></marker></defs>`);
  parts.push(`<defs>
    <marker id="triangle" markerWidth="12" markerHeight="12" refX="11" refY="6" orient="auto"><path d="M 1 1 L 11 6 L 1 11 Z" fill="white" stroke="#333" /></marker>
    <marker id="composition" markerWidth="16" markerHeight="12" refX="1" refY="6" orient="auto"><path d="M 1 6 L 8 1 L 15 6 L 8 11 Z" fill="#333" stroke="#333" /></marker>
    <marker id="aggregation" markerWidth="16" markerHeight="12" refX="1" refY="6" orient="auto"><path d="M 1 6 L 8 1 L 15 6 L 8 11 Z" fill="white" stroke="#333" /></marker>
  </defs>`);
  parts.push(`<rect width="100%" height="100%" fill="${escapeXml(backgroundColor)}" />`);

  // Render connectors first (behind elements)
  diagram.connectors.forEach((conn, index) => {
    parts.push(renderConnectorSVG(conn, diagram.elements, offsetX, offsetY, diagram.type === 'sequence' ? index : undefined));
  });

  // Render elements
  for (const el of diagram.elements) {
    parts.push(renderElementSVG(el, offsetX, offsetY));
  }

  parts.push('</svg>');
  return parts.join('\n');
}

// =============================================================================
// Export Engine
// =============================================================================

export const ExportEngine = {
  /**
   * Export diagram as SVG string.
   */
  exportSVG(diagram: DiagramData, options?: ExportOptions): string {
    if (!diagram) {
      throw new Error('Export failed: No diagram data provided');
    }
    if (diagram.elements.length === 0) {
      throw new Error('Export failed: Diagram has no elements to export');
    }
    try {
      return buildSVGString(diagram, resolveOptions(options));
    } catch (err) {
      throw new Error(`SVG export failed: ${(err as Error).message}`);
    }
  },

  /**
   * Export diagram as PNG data URL.
   * Requires DOM (canvas element) — works in Electron renderer process.
   */
  async exportPNG(diagram: DiagramData, options?: ExportOptions): Promise<string> {
    if (!diagram) {
      throw new Error('Export failed: No diagram data provided');
    }
    if (diagram.elements.length === 0) {
      throw new Error('Export failed: Diagram has no elements to export');
    }
    try {
      const opts = resolveOptions(options);
      const svgString = buildSVGString(diagram, opts);
      const bounds = computeBounds(diagram);
      const svgWidth = bounds.width + opts.padding * 2;
      const svgHeight = bounds.height + opts.padding * 2;

      // Create an off-screen canvas
      const canvas = document.createElement('canvas');
      canvas.width = svgWidth * opts.scale;
      canvas.height = svgHeight * opts.scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Cannot create canvas 2D context');

      ctx.scale(opts.scale, opts.scale);

      // Load SVG as image
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      return new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('PNG export failed: Could not render SVG to canvas'));
        };
        img.src = url;
      });
    } catch (err) {
      throw new Error(`PNG export failed: ${(err as Error).message}`);
    }
  },

};
