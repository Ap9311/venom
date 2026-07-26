/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Post } from '../../types';
import { Activity, Users, Cpu, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AdminTelemetryProps {
  posts: Post[];
}

export const AdminTelemetry: React.FC<AdminTelemetryProps> = ({ posts }) => {
  // Real observer count based on actual unique IP addresses that have ever posted + current observer
  const uniqueIps = Array.from(new Set(posts.map(p => p.postedFromIp).filter(Boolean)));
  const liveObservers = Math.max(1, uniqueIps.length);

  // Compute analytics
  const totalVenomsCount = posts.length;
  const totalLikes = posts.reduce((acc, p) => acc + (p.likesCount || 0), 0);
  const totalUpvotes = posts.reduce((acc, p) => acc + (p.upvotesCount || 0), 0);
  const totalDownvotes = posts.reduce((acc, p) => acc + (p.downvotesCount || 0), 0);
  const totalComments = posts.reduce((acc, p) => acc + (p.commentsCount || 0), 0);
  const totalInteractions = totalLikes + totalUpvotes + totalDownvotes + totalComments;

  const averageEngagement = totalVenomsCount > 0 
    ? (totalInteractions / totalVenomsCount).toFixed(1) 
    : '0.0';

  const rawBytes = posts.reduce((acc, p) => {
    return acc + (p.title?.length || 0) + (p.content?.length || 0) + (p.imageUrl?.length || 0);
  }, 0) * 2; // approximation for UTF-16 characters in bytes

  const displayStorage = rawBytes > 1024 * 1024 
    ? `${(rawBytes / (1024 * 1024)).toFixed(2)} MB`
    : rawBytes > 1024
      ? `${(rawBytes / 1024).toFixed(1)} KB`
      : `${rawBytes} B`;

  // Graph and animation state
  const [hoveredDataIndex, setHoveredDataIndex] = useState<number | null>(null);
  const [hoveredNode, setHoveredNode] = useState<{ label: string; category: string; description: string } | null>(null);
  const [graphTime, setGraphTime] = useState(0);

  // Obsidian Force-Graph Animation loop
  useEffect(() => {
    let animId: number;
    const run = () => {
      setGraphTime(t => t + 0.005);
      animId = requestAnimationFrame(run);
    };
    animId = requestAnimationFrame(run);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="space-y-6">
      {/* STATS BENTO GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        
        <div className="bg-zinc-900/30 border border-zinc-900 rounded-lg p-4 backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-2 right-2 text-emerald-500/10">
            <Activity className="w-12 h-12" />
          </div>
          <span className="text-[9px] uppercase text-zinc-500 block font-bold">TOTAL FIRESTORE VENOMS</span>
          <span className="text-2xl font-black text-emerald-400 mt-1 block tracking-tight">
            {totalVenomsCount}
          </span>
          <span className="text-[9px] text-zinc-500 mt-1.5 block">Active database documents</span>
        </div>

        <div className="bg-zinc-900/30 border border-zinc-900 rounded-lg p-4 backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-2 right-2 text-emerald-500/10">
            <Users className="w-12 h-12 text-emerald-500/10" />
          </div>
          <span className="text-[9px] uppercase text-zinc-500 block font-bold">LIVE SITE OBSERVERS</span>
          <span className="text-2xl font-black text-zinc-100 mt-1 block tracking-tight flex items-center gap-1.5 font-mono">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse inline-block" />
            {liveObservers}
          </span>
          <span className="text-[9px] text-zinc-500 mt-1.5 block">Unique poster IPs connected</span>
        </div>

        <div className="bg-zinc-900/30 border border-zinc-900 rounded-lg p-4 backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-2 right-2 text-emerald-500/10">
            <Cpu className="w-12 h-12 text-emerald-500/10" />
          </div>
          <span className="text-[9px] uppercase text-zinc-500 block font-bold">AVG ENGAGEMENT RATIO</span>
          <span className="text-2xl font-black text-zinc-200 mt-1 block tracking-tight">
            {averageEngagement}
          </span>
          <span className="text-[9px] text-zinc-500 mt-1.5 block">Interactions per Venom</span>
        </div>

        <div className="bg-zinc-900/30 border border-zinc-900 rounded-lg p-4 backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-2 right-2 text-emerald-500/10">
            <Database className="w-12 h-12" />
          </div>
          <span className="text-[9px] uppercase text-zinc-500 block font-bold">TOTAL STORAGE FOOTPRINT</span>
          <span className="text-2xl font-black text-zinc-200 mt-1 block tracking-tight">
            {displayStorage}
          </span>
          <span className="text-[9px] text-zinc-500 mt-1.5 block">Payload size approximation</span>
        </div>

      </div>

      {/* OBSIDIAN GRAPH & INTERACTIVE PRODUCTIVITY WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-zinc-900/15 border border-zinc-900 rounded-xl p-5 backdrop-blur-md relative overflow-hidden">
        
        {/* LEFT COMPONENT: OBSIDIAN STYLE FORCE GRAPH (5 Columns) */}
        <div className="lg:col-span-5 bg-zinc-950/80 border border-zinc-900 rounded-lg p-4 relative flex flex-col justify-between min-h-[360px]">
          <div>
            <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-widest flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <span>Decentralized Core Graph</span>
            </h3>
            <p className="text-[10px] text-zinc-500 leading-relaxed mt-1">
              Interactive 3-Tier clustering topography mapping real-time connections between database categories and node venoms.
            </p>
          </div>

          {/* Interactive Force-Graph SVG Container */}
          <div className="relative flex-1 flex items-center justify-center my-2 select-none overflow-hidden h-[240px]">
            <svg viewBox="0 0 400 320" className="w-full h-full max-h-[240px]">
              <defs>
                <filter id="glow-hub" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Central Core Connection Line Grid */}
              <circle cx={200} cy={160} r={105} fill="none" stroke="#27272a" strokeWidth={0.5} strokeDasharray="2,5" />
              <circle cx={200} cy={160} r={40} fill="none" stroke="#27272a" strokeWidth={0.5} strokeDasharray="3,3" />

              {(() => {
                // Define categories & clustering geometry
                const categoriesList = [
                  { id: 'general', label: '#general', color: '#10b981', angle: 0 },
                  { id: 'leaks', label: '#leaks', color: '#3b82f6', angle: 72 },
                  { id: 'theories', label: '#theories', color: '#ec4899', angle: 144 },
                  { id: 'dossiers', label: '#dossiers', color: '#f59e0b', angle: 216 },
                  { id: 'intel', label: '#intel', color: '#a855f7', angle: 288 },
                ];

                // Group the latest posts by category for cluster links
                const postsByCat: { [key: string]: Post[] } = {};
                categoriesList.forEach(c => { postsByCat[c.id] = []; });
                posts.slice(0, 18).forEach(p => {
                  if (postsByCat[p.category]) postsByCat[p.category].push(p);
                  else postsByCat['general'].push(p);
                });

                const renderedLinks: React.ReactNode[] = [];
                const renderedNodes: React.ReactNode[] = [];

                categoriesList.forEach(cat => {
                  // Calculate orbital path for channel hubs
                  const hubAngle = (cat.angle * Math.PI) / 180 + graphTime * 0.3;
                  const hubX = 200 + Math.cos(hubAngle) * 65;
                  const hubY = 160 + Math.sin(hubAngle) * 65;

                  // Central core links
                  renderedLinks.push(
                    <line 
                      key={`core-link-${cat.id}`}
                      x1={200} y1={160} x2={hubX} y2={hubY}
                      stroke="#27272a" strokeWidth={0.8} strokeDasharray="3,3"
                    />
                  );

                  // Category posts cluster
                  const clusterPosts = postsByCat[cat.id];
                  const postCount = clusterPosts.length;

                  clusterPosts.forEach((postItem, idx) => {
                    const pAngle = (idx * (360 / Math.max(1, postCount)) * Math.PI) / 180 + graphTime * 0.6;
                    const pX = hubX + Math.cos(pAngle) * 25;
                    const pY = hubY + Math.sin(pAngle) * 25;

                    // Linking post node to category hub node
                    renderedLinks.push(
                      <line
                        key={`post-link-${postItem.id}`}
                        x1={hubX} y1={hubY} x2={pX} y2={pY}
                        stroke={cat.color} strokeWidth={0.5} opacity={0.3}
                      />
                    );

                    // Post nodes
                    renderedNodes.push(
                      <g key={`post-g-${postItem.id}`}>
                        <circle
                          cx={pX} cy={pY} r={3}
                          fill="#52525b"
                          className="hover:fill-emerald-400 cursor-pointer transition-colors duration-150"
                          onMouseEnter={() => setHoveredNode({
                            label: postItem.title || 'Anonymous Venom',
                            category: cat.label,
                            description: postItem.content?.substring(0, 80) + '...'
                          })}
                          onMouseLeave={() => setHoveredNode(null)}
                        />
                      </g>
                    );
                  });

                  // Drawing category hub nodes on top
                  renderedNodes.push(
                    <g key={`hub-g-${cat.id}`}>
                      <circle
                        cx={hubX} cy={hubY} r={5.5}
                        fill={cat.color}
                        className="cursor-pointer"
                        style={{ filter: 'url(#glow-hub)' }}
                        onMouseEnter={() => setHoveredNode({
                          label: cat.label,
                          category: 'Active Channel Hub',
                          description: `${postCount} active database threads deployed under this node.`
                        })}
                        onMouseLeave={() => setHoveredNode(null)}
                      />
                    </g>
                  );
                });

                return (
                  <>
                    {renderedLinks}
                    {renderedNodes}
                  </>
                );
              })()}

              {/* Central Core Sphere */}
              <circle cx={200} cy={160} r={4} fill="#ffffff" stroke="#10b981" strokeWidth={1} />
            </svg>

            {/* Tooltip Popup overlay */}
            <AnimatePresence>
              {hoveredNode && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="absolute bottom-2 left-2 right-2 bg-zinc-950 border border-zinc-900 rounded p-2.5 text-[10px] font-mono leading-relaxed shadow-2xl pointer-events-none z-30"
                >
                  <div className="flex items-center justify-between text-zinc-500 mb-0.5 uppercase text-[8px] font-bold">
                    <span>{hoveredNode.category}</span>
                    <span className="text-emerald-400">GRAPH DEPLOYMENT</span>
                  </div>
                  <div className="text-zinc-200 font-bold mb-1 truncate">{hoveredNode.label}</div>
                  <div className="text-zinc-500 leading-normal">{hoveredNode.description}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center justify-between text-[8px] font-mono text-zinc-600 border-t border-zinc-900/60 pt-2 mt-1">
            <span>SYSTEM FEEDBACK: STABLE</span>
            <span>100% DECENTRALIZED COHESION</span>
          </div>
        </div>

        {/* RIGHT COMPONENT: DYNAMIC PRODUCTIVITY LINE CHART (7 Columns) */}
        <div className="lg:col-span-7 bg-zinc-950/80 border border-zinc-900 rounded-lg p-4 relative flex flex-col justify-between min-h-[360px]">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-widest flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span>Productivity & Activity Index</span>
              </h3>
              <span className="text-[9px] bg-zinc-900 border border-zinc-850 text-emerald-400 px-2 py-0.5 rounded uppercase font-bold">
                24-Hour Cycle
              </span>
            </div>
            <p className="text-[10px] text-zinc-500 leading-relaxed mt-1">
              Decentralized system postings throughput mapped dynamically to actual user database transactions.
            </p>
          </div>

          {/* SVG Graph Generation */}
          <div className="relative flex-1 flex items-center justify-center my-3 min-h-[200px]">
            {(() => {
              // Compute chart parameters dynamically based on actual Firestore posts count
              const hours = ['02:00', '06:00', '10:00', '14:00', '18:00', '22:00'];
              const linePoints = hours.map((hourStr) => {
                const hourNum = parseInt(hourStr.split(':')[0]);
                const matchedPosts = posts.filter(p => {
                  if (!p.createdAt) return false;
                  let date: Date;
                  if (p.createdAt.toDate) {
                    date = p.createdAt.toDate();
                  } else if (p.createdAt instanceof Date) {
                    date = p.createdAt;
                  } else {
                    date = new Date(p.createdAt);
                  }
                  const postHour = date.getHours();
                  return postHour >= hourNum - 2 && postHour < hourNum + 2;
                });

                const value = matchedPosts.length;
                const engagement = matchedPosts.reduce((acc, p) => acc + (p.likesCount || 0) + (p.commentsCount || 0) + (p.upvotesCount || 0), 0);
                const active = Array.from(new Set(matchedPosts.map(p => p.postedFromIp).filter(Boolean))).length;

                return {
                  hour: hourStr,
                  value,
                  engagement,
                  active: Math.max(1, active)
                };
              });

              const width = 450;
              const height = 180;
              const paddingLeft = 40;
              const paddingRight = 20;
              const paddingTop = 20;
              const paddingBottom = 30;

              const plotWidth = width - paddingLeft - paddingRight;
              const plotHeight = height - paddingTop - paddingBottom;

              const maxVal = Math.max(...linePoints.map(p => p.value));
              const maxAxisVal = maxVal > 0 ? maxVal * 1.2 : 10;

              const getPlotX = (index: number) => paddingLeft + index * (plotWidth / (linePoints.length - 1));
              const getPlotY = (val: number) => paddingTop + plotHeight - (val / maxAxisVal) * plotHeight;

              // Compute smooth curve path
              const pathCoordinates = linePoints.map((p, idx) => ({
                x: getPlotX(idx),
                y: getPlotY(p.value)
              }));

              let pathD = '';
              if (pathCoordinates.length > 0) {
                pathD = `M ${pathCoordinates[0].x} ${pathCoordinates[0].y}`;
                for (let i = 1; i < pathCoordinates.length; i++) {
                  const prev = pathCoordinates[i - 1];
                  const curr = pathCoordinates[i];
                  // Bezier smoothing coordinates
                  const cpX1 = prev.x + (curr.x - prev.x) / 2;
                  const cpY1 = prev.y;
                  const cpX2 = prev.x + (curr.x - prev.x) / 2;
                  const cpY2 = curr.y;
                  pathD += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${curr.x} ${curr.y}`;
                }
              }

              const areaD = pathCoordinates.length > 0
                ? `${pathD} L ${pathCoordinates[pathCoordinates.length - 1].x} ${height - paddingBottom} L ${pathCoordinates[0].x} ${height - paddingBottom} Z`
                : '';

              return (
                <div className="w-full h-full flex flex-col justify-between">
                  <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
                    <defs>
                      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                      </linearGradient>
                      <filter id="glow-line" x="-10%" y="-10%" width="120%" height="120%">
                        <feGaussianBlur stdDeviation="2" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                      </filter>
                    </defs>

                    {/* Grid Background Lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((r, i) => {
                      const y = paddingTop + plotHeight * r;
                      const gridVal = Math.round(maxAxisVal * (1 - r));
                      return (
                        <g key={`grid-line-${i}`}>
                          <line 
                            x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} 
                            stroke="#18181b" strokeWidth={1} 
                          />
                          <text 
                            x={paddingLeft - 8} y={y + 3} 
                            fill="#52525b" fontSize="8" fontFamily="monospace" textAnchor="end"
                          >
                            {gridVal}
                          </text>
                        </g>
                      );
                    })}

                    {/* SVG Area Under Path */}
                    {areaD && <path d={areaD} fill="url(#areaGrad)" />}

                    {/* Path Line */}
                    {pathD && (
                      <path 
                        d={pathD} 
                        fill="none" 
                        stroke="#10b981" 
                        strokeWidth={2} 
                        style={{ filter: 'url(#glow-line)' }}
                      />
                    )}

                    {/* Hover Guide Line */}
                    {hoveredDataIndex !== null && (
                      <line
                        x1={getPlotX(hoveredDataIndex)}
                        y1={paddingTop}
                        x2={getPlotX(hoveredDataIndex)}
                        y2={height - paddingBottom}
                        stroke="#27272a"
                        strokeWidth={1}
                        strokeDasharray="2,2"
                      />
                    )}

                    {/* Plot Data Dots */}
                    {linePoints.map((point, idx) => {
                      const cx = getPlotX(idx);
                      const cy = getPlotY(point.value);
                      const isHovered = hoveredDataIndex === idx;

                      return (
                        <g key={`point-circle-${idx}`}>
                          <circle
                            cx={cx}
                            cy={cy}
                            r={isHovered ? 6 : 3.5}
                            fill={isHovered ? '#10b981' : '#18181b'}
                            stroke="#10b981"
                            strokeWidth={1.5}
                            className="cursor-pointer transition-all duration-150"
                            onMouseEnter={() => setHoveredDataIndex(idx)}
                            onMouseLeave={() => setHoveredDataIndex(null)}
                          />
                          <text
                            x={cx}
                            y={height - paddingBottom + 12}
                            fill={isHovered ? '#10b981' : '#52525b'}
                            fontSize="8"
                            fontFamily="monospace"
                            textAnchor="middle"
                          >
                            {point.hour}
                          </text>
                        </g>
                      );
                    })}
                  </svg>

                  {/* Interactive Tooltip Overlay */}
                  <div className="h-[44px] bg-zinc-900/40 border border-zinc-900/60 p-2 rounded flex items-center justify-between text-[10px] font-mono text-zinc-400 mt-1">
                    {hoveredDataIndex !== null ? (
                      <>
                        <div>
                          <span className="text-zinc-600 uppercase text-[8px] block font-bold">INTERVAL</span>
                          <span className="text-zinc-200 font-bold font-sans">{linePoints[hoveredDataIndex].hour} EST</span>
                        </div>
                        <div className="text-center">
                          <span className="text-zinc-600 uppercase text-[8px] block font-bold">POSTS INGESTED</span>
                          <span className="text-emerald-400 font-bold">{linePoints[hoveredDataIndex].value} items</span>
                        </div>
                        <div className="text-center">
                          <span className="text-zinc-600 uppercase text-[8px] block font-bold">TOTAL ENGAGEMENTS</span>
                          <span className="text-zinc-200 font-bold">{linePoints[hoveredDataIndex].engagement} hits</span>
                        </div>
                        <div className="text-right">
                          <span className="text-zinc-600 uppercase text-[8px] block font-bold">ACTIVE ROUTING NODES</span>
                          <span className="text-emerald-400 font-bold font-sans">{linePoints[hoveredDataIndex].active}</span>
                        </div>
                      </>
                    ) : (
                      <div className="text-center w-full text-zinc-500 italic text-[9px]">
                        Hover any data node on the grid chart to capture active interval metrics.
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="flex items-center justify-between text-[8px] font-mono text-zinc-600 border-t border-zinc-900/60 pt-2">
            <span>ANALYSIS SCOPE: CONTINUOUS</span>
            <span>UTC TIME STAMP ENFORCED</span>
          </div>
        </div>

      </div>
    </div>
  );
};
