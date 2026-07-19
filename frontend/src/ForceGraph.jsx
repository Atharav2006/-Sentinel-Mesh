import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

const TIER_COLOR = {
  HIGH_RISK:  '#ef4444',
  SUSPICIOUS: '#f59e0b',
  CLEAN:      '#10b981',
};

const CONF_RING = {
  HIGH:   '#ef4444',
  MEDIUM: '#f59e0b',
  LOW:    '#f59e0b88',
  NONE:   'transparent',
};

function nodeRadius(d) {
  if (d.tier === 'HIGH_RISK')  return 22;
  if (d.tier === 'SUSPICIOUS') return 16;
  return 12;
}

export default function ForceGraph({ graphData, onNodeClick }) {
  const svgRef  = useRef(null);
  const simRef  = useRef(null);
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
    if (!graphData || !svgRef.current) return;
    const { nodes: rawNodes, edges: rawEdges } = graphData;
    if (!rawNodes.length) return;

    const el     = svgRef.current;
    const width  = el.clientWidth  || 860;
    const height = el.clientHeight || 480;

    // Clear previous
    d3.select(el).selectAll('*').remove();

    const svg = d3.select(el)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('width',  '100%')
      .attr('height', '100%');

    // ── Defs: glow filter + arrow marker ──────────────────────────────────────
    const defs = svg.append('defs');

    const mkGlow = (id, color) => {
      const f = defs.append('filter').attr('id', id).attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
      f.append('feGaussianBlur').attr('stdDeviation', 4).attr('result', 'coloredBlur');
      const fMerge = f.append('feMerge');
      fMerge.append('feMergeNode').attr('in', 'coloredBlur');
      fMerge.append('feMergeNode').attr('in', 'SourceGraphic');
    };
    mkGlow('glow-red',    '#ef4444');
    mkGlow('glow-yellow', '#f59e0b');
    mkGlow('glow-green',  '#10b981');

    defs.append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -4 8 8')
      .attr('refX', 24).attr('refY', 0)
      .attr('markerWidth', 6).attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-4L8,0L0,4')
      .attr('fill', 'rgba(255,255,255,0.15)');

    // ── Deep-copy nodes/edges for D3 mutation ─────────────────────────────────
    const nodes = rawNodes.map(n => ({ ...n }));
    const edges = rawEdges.map(e => ({ ...e }));

    // ── Background grid ───────────────────────────────────────────────────────
    const bg = svg.append('g').attr('class', 'bg');
    for (let x = 0; x < width; x += 40)
      bg.append('line').attr('x1', x).attr('y1', 0).attr('x2', x).attr('y2', height)
        .attr('stroke', 'rgba(99,102,241,0.04)').attr('stroke-width', 1);
    for (let y = 0; y < height; y += 40)
      bg.append('line').attr('x1', 0).attr('y1', y).attr('x2', width).attr('y2', y)
        .attr('stroke', 'rgba(99,102,241,0.04)').attr('stroke-width', 1);

    // ── Zoom ─────────────────────────────────────────────────────────────────
    const g = svg.append('g');
    svg.call(d3.zoom().scaleExtent([0.3, 3]).on('zoom', e => g.attr('transform', e.transform)));

    // ── Links ─────────────────────────────────────────────────────────────────
    const link = g.append('g').selectAll('line')
      .data(edges).join('line')
      .attr('stroke', d => d.weight === 3 ? '#ef4444' : d.weight === 2 ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.08)')
      .attr('stroke-width', d => d.weight === 3 ? 4 : d.weight === 2 ? 2 : 1)
      .attr('stroke-dasharray', d => (d.weight === 2 || d.weight === 3) ? '0' : '4,4')
      .attr('filter', d => d.weight === 3 ? 'url(#glow-red)' : null)
      .attr('marker-end', d => d.weight === 3 ? null : 'url(#arrow)');

    // ── Node groups ───────────────────────────────────────────────────────────
    const node = g.append('g').selectAll('g')
      .data(nodes).join('g')
      .attr('cursor', 'pointer')
      .call(d3.drag()
        .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag',  (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on('end',   (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; })
      )
      .on('click', (e, d) => { e.stopPropagation(); onNodeClick?.(d); })
      .on('mouseenter', (e, d) => {
        setTooltip({ x: e.clientX, y: e.clientY, node: d });
      })
      .on('mouseleave', () => setTooltip(null));

    // Pulse ring for flagged nodes
    node.filter(d => d.is_flagged)
      .append('circle')
      .attr('r', d => nodeRadius(d) + 8)
      .attr('fill', 'none')
      .attr('stroke', d => CONF_RING[d.confidence_tier] || 'transparent')
      .attr('stroke-width', 1.5)
      .attr('opacity', 0.5)
      .attr('class', 'pulse-ring');

    // Main circle
    node.append('circle')
      .attr('r', d => nodeRadius(d))
      .attr('fill', d => `${TIER_COLOR[d.tier] || '#6366f1'}22`)
      .attr('stroke', d => TIER_COLOR[d.tier] || '#6366f1')
      .attr('stroke-width', 2)
      .attr('filter', d =>
        d.tier === 'HIGH_RISK'  ? 'url(#glow-red)'    :
        d.tier === 'SUSPICIOUS' ? 'url(#glow-yellow)'  :
        'url(#glow-green)'
      );

    // Label
    node.append('text')
      .text(d => d.label)
      .attr('text-anchor', 'middle')
      .attr('dy', d => nodeRadius(d) + 14)
      .attr('font-size', 10)
      .attr('font-family', 'Inter, sans-serif')
      .attr('fill', d => TIER_COLOR[d.tier] || '#9ca3af')
      .attr('font-weight', d => d.is_flagged ? 700 : 400);

    // Flag count badge
    node.filter(d => d.flag_count > 0)
      .append('circle')
      .attr('cx', d => nodeRadius(d) - 4)
      .attr('cy', d => -(nodeRadius(d) - 4))
      .attr('r', 8)
      .attr('fill', '#ef4444')
      .attr('stroke', '#030712')
      .attr('stroke-width', 2);

    node.filter(d => d.flag_count > 0)
      .append('text')
      .text(d => d.flag_count)
      .attr('x',  d => nodeRadius(d) - 4)
      .attr('y',  d => -(nodeRadius(d) - 4))
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', 9)
      .attr('font-weight', 700)
      .attr('fill', 'white')
      .attr('font-family', 'Inter, sans-serif');

    // ── Force simulation ──────────────────────────────────────────────────────
    const sim = d3.forceSimulation(nodes)
      .force('link',   d3.forceLink(edges).id(d => d.id).distance(120).strength(0.4))
      .force('charge', d3.forceManyBody().strength(-280))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius(d => nodeRadius(d) + 30))
      .on('tick', () => {
        link
          .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
        node.attr('transform', d => `translate(${d.x},${d.y})`);
      });

    simRef.current = sim;

    // Pulse animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse-ring {
        0%   { r: ${10}; opacity: 0.6; }
        100% { r: ${28}; opacity: 0; }
      }
      .pulse-ring { animation: pulse-ring 2s ease-out infinite; }
    `;
    document.head.appendChild(style);

    return () => {
      sim.stop();
      document.head.removeChild(style);
    };
  }, [graphData]);

  return (
    <div style={{ position: 'relative', width: '100%', height: 480, background: 'rgba(3,7,18,0.6)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
      <svg ref={svgRef} style={{ width: '100%', height: '100%' }} />

      {/* Legend */}
      <div style={{ position: 'absolute', bottom: 14, left: 16, display: 'flex', gap: 16, fontSize: 11, color: '#6b7280' }}>
        {[['HIGH RISK', '#ef4444'], ['SUSPICIOUS', '#f59e0b'], ['CLEAN', '#10b981']].map(([label, color]) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block', boxShadow: `0 0 6px ${color}` }} />
            {label}
          </span>
        ))}
        <span style={{ marginLeft: 8, color: '#4b5563' }}>Drag nodes · Scroll to zoom</span>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: 'fixed', left: tooltip.x + 12, top: tooltip.y - 8,
          background: '#111827', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8, padding: '10px 14px', fontSize: 12,
          color: '#e5e7eb', pointerEvents: 'none', zIndex: 9999,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          minWidth: 200,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 6, color: TIER_COLOR[tooltip.node.tier] || '#fff' }}>
            {tooltip.node.label}
          </div>
          <div style={{ color: '#9ca3af', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, marginBottom: 6 }}>
            {tooltip.node.id.slice(0, 14)}...{tooltip.node.id.slice(-6)}
          </div>
          <div>Tier: <span style={{ color: TIER_COLOR[tooltip.node.tier] }}>{tooltip.node.tier}</span></div>
          {tooltip.node.flag_count > 0 && (
            <div>Flags: <span style={{ color: '#ef4444', fontWeight: 700 }}>{tooltip.node.flag_count} · {tooltip.node.confidence_tier}</span></div>
          )}
        </div>
      )}
    </div>
  );
}
