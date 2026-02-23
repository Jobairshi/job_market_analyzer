'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  SimulationNodeDatum,
  SimulationLinkDatum,
} from 'd3-force';
import { scaleLinear, scaleOrdinal } from 'd3-scale';
import type { SkillClusterData } from '@/lib/api';

/* ── Types for simulation ──────────────────────────────── */

interface SimNode extends SimulationNodeDatum {
  id: string;
  count: number;
  group: number;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  weight: number;
}

/* ── Color palette for groups ──────────────────────────── */

const GROUP_COLORS = [
  '#6366f1', // indigo
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#a855f7', // purple
];

interface Props {
  data: SkillClusterData;
}

export default function SkillClusterGraph({ data }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 700, height: 500 });
  const [hoveredNode, setHoveredNode] = useState<SimNode | null>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const linksRef = useRef<SimLink[]>([]);

  // Responsive sizing
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      setDimensions({ width: Math.max(400, width), height: 500 });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Force simulation
  useEffect(() => {
    if (!data.nodes.length) return;

    const { width, height } = dimensions;

    // Clone data to avoid mutation
    const nodes: SimNode[] = data.nodes.map((n) => ({
      ...n,
      x: width / 2 + (Math.random() - 0.5) * 200,
      y: height / 2 + (Math.random() - 0.5) * 200,
    }));

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    const links: SimLink[] = data.links
      .filter((l) => nodeMap.has(l.source) && nodeMap.has(l.target))
      .map((l) => ({
        source: nodeMap.get(l.source as string)!,
        target: nodeMap.get(l.target as string)!,
        weight: l.weight,
      }));

    nodesRef.current = nodes;
    linksRef.current = links;

    // Scales
    const maxCount = Math.max(...nodes.map((n) => n.count), 1);
    const radiusScale = scaleLinear().domain([1, maxCount]).range([6, 28]);
    const groupColor = scaleOrdinal<number, string>()
      .domain(Array.from(new Set(nodes.map((n) => n.group))))
      .range(GROUP_COLORS);

    const maxWeight = Math.max(...links.map((l) => l.weight), 1);
    const linkWidthScale = scaleLinear().domain([1, maxWeight]).range([0.5, 3]);
    const linkOpacityScale = scaleLinear().domain([1, maxWeight]).range([0.1, 0.4]);

    // Simulation
    const simulation = forceSimulation(nodes)
      .force(
        'link',
        forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance(100)
          .strength((l) => Math.min(l.weight / maxWeight, 0.8)),
      )
      .force('charge', forceManyBody().strength(-120))
      .force('center', forceCenter(width / 2, height / 2))
      .force(
        'collide',
        forceCollide<SimNode>().radius((d) => radiusScale(d.count) + 4),
      )
      .alphaDecay(0.02);

    // Canvas rendering
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      // Draw links
      for (const link of links) {
        const src = link.source as SimNode;
        const tgt = link.target as SimNode;
        if (src.x == null || src.y == null || tgt.x == null || tgt.y == null)
          continue;

        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(tgt.x, tgt.y);
        ctx.strokeStyle = `rgba(148, 163, 184, ${linkOpacityScale(link.weight)})`;
        ctx.lineWidth = linkWidthScale(link.weight);
        ctx.stroke();
      }

      // Draw nodes
      for (const node of nodes) {
        if (node.x == null || node.y == null) continue;
        const r = radiusScale(node.count);

        // Glow effect for larger nodes
        if (r > 12) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, r + 4, 0, 2 * Math.PI);
          ctx.fillStyle = `${groupColor(node.group)}22`;
          ctx.fill();
        }

        // Node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
        ctx.fillStyle = groupColor(node.group);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Label
        ctx.fillStyle = '#1e293b';
        ctx.font = `${r > 14 ? 'bold ' : ''}${Math.max(9, Math.min(12, r * 0.7))}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(node.id, node.x, node.y + r + 4);
      }
    }

    simulation.on('tick', draw);

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [data, dimensions]);

  // Mouse hover detection
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const maxCount = Math.max(...nodesRef.current.map((n) => n.count), 1);
      const radiusScale = scaleLinear().domain([1, maxCount]).range([6, 28]);

      let found: SimNode | null = null;
      for (const node of nodesRef.current) {
        if (node.x == null || node.y == null) continue;
        const r = radiusScale(node.count);
        const dx = mx - node.x;
        const dy = my - node.y;
        if (dx * dx + dy * dy < (r + 4) * (r + 4)) {
          found = node;
          break;
        }
      }
      setHoveredNode(found);
      canvas.style.cursor = found ? 'pointer' : 'default';
    },
    [],
  );

  if (!data.nodes.length) {
    return (
      <div className="flex h-[500px] items-center justify-center text-gray-400">
        No cluster data available
      </div>
    );
  }

  // Build legend from groups
  const groups = Array.from(new Set(data.nodes.map((n) => n.group))).sort((a, b) => a - b);

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">
            Skill Co-occurrence Clusters
          </h3>
          <p className="mt-0.5 text-xs text-gray-400">
            Skills that appear together in job postings — node size = frequency, links = co-occurrence
          </p>
        </div>
        {/* Legend */}
        <div className="flex flex-wrap gap-2">
          {groups.slice(0, 6).map((g) => (
            <span
              key={g}
              className="inline-flex items-center gap-1 text-xs text-gray-500"
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: GROUP_COLORS[g % GROUP_COLORS.length] }}
              />
              Cluster {g + 1}
            </span>
          ))}
        </div>
      </div>

      {/* Graph container */}
      <div ref={containerRef} className="relative w-full">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredNode(null)}
          className="w-full rounded-lg bg-slate-50"
          style={{ height: 500 }}
        />

        {/* Tooltip */}
        {hoveredNode && hoveredNode.x != null && hoveredNode.y != null && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-lg"
            style={{
              left: Math.min(hoveredNode.x, dimensions.width - 160),
              top: Math.max(hoveredNode.y - 60, 0),
            }}
          >
            <p className="font-semibold text-gray-800">{hoveredNode.id}</p>
            <p className="text-gray-500">
              Appears in <span className="font-medium text-gray-700">{hoveredNode.count}</span> jobs
            </p>
            <p className="text-gray-400 text-xs">
              Cluster {hoveredNode.group + 1} &middot;{' '}
              {linksRef.current.filter(
                (l) =>
                  (l.source as SimNode).id === hoveredNode.id ||
                  (l.target as SimNode).id === hoveredNode.id,
              ).length}{' '}
              connections
            </p>
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div className="mt-3 flex gap-6 text-xs text-gray-400">
        <span>{data.nodes.length} skills</span>
        <span>{data.links.length} co-occurrence links</span>
        <span>{groups.length} clusters detected</span>
      </div>
    </div>
  );
}

export function SkillClusterGraphSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-4 h-5 w-52 rounded bg-gray-200" />
      <div className="h-[500px] rounded-lg bg-gray-100" />
    </div>
  );
}
