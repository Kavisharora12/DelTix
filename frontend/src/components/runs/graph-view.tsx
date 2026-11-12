"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import {
  Calculator,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Coins,
  FileCode2,
  AlertCircle,
} from "lucide-react";
import { RunItem, GraphNodeData } from "@/types";
import { CustomNode } from "./custom-node";
import { JsonViewer } from "@/components/ui/json-viewer";
import { ApprovalDecisionPanel } from "./approval-decision-panel";
import { cn } from "@/lib/utils";

const nodeTypes = {
  custom: CustomNode,
};

interface GraphViewProps {
  run: RunItem;
}

// Layout helper with dagre (n8n horizontal spacing)
function getLayoutedElements(nodes: any[], edges: any[]) {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: "LR", ranksep: 85, nodesep: 45 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 140, height: 135 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 70,
        y: nodeWithPosition.y - 67,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

export function GraphView({ run }: GraphViewProps) {
  // Default selected node is the waiting or failed node, or the first node
  const initialSelectedNode = useMemo(() => {
    const waiting = run.nodes.find((n) => n.status === "waiting");
    if (waiting) return waiting;
    const failed = run.nodes.find((n) => n.status === "failed");
    if (failed) return failed;
    const running = run.nodes.find((n) => n.status === "running");
    if (running) return running;
    return run.nodes[0] || null;
  }, [run.nodes]);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    initialSelectedNode?.id || null
  );

  const selectedNode = run.nodes.find((n) => n.id === selectedNodeId) || null;

  // Transform nodes to React Flow format
  const initialNodes = useMemo(() => {
    return run.nodes.map((node) => ({
      id: node.id,
      type: "custom",
      data: {
        title: node.title,
        type: node.type,
        status: node.status,
        nodeId: node.id,
      },
      position: { x: 0, y: 0 },
      selected: node.id === selectedNodeId,
    }));
  }, [run.nodes, selectedNodeId]);

  // n8n smooth bezier edges
  const initialEdges = useMemo(() => {
    return run.edges.map((edge) => {
      const isExecuting = edge.isExecuting;
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: "default",
        style: {
          stroke: isExecuting ? "#E8602E" : "#52525B",
          strokeWidth: 2,
          strokeDasharray: isExecuting ? "5 5" : undefined,
        },
        animated: isExecuting,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isExecuting ? "#E8602E" : "#52525B",
          width: 14,
          height: 14,
        },
      };
    });
  }, [run.edges]);

  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(
    () => getLayoutedElements(initialNodes, initialEdges),
    [initialNodes, initialEdges]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  useEffect(() => {
    const layout = getLayoutedElements(initialNodes, initialEdges);
    setNodes(layout.nodes);
    setEdges(layout.edges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onNodeClick = (_: any, node: any) => {
    setSelectedNodeId(node.id);
  };

  const isWaitingApproval = run.status === "PAUSED_FOR_APPROVAL";

  return (
    <div className="flex-1 flex min-h-0 h-full overflow-hidden select-none bg-app">
      {/* Left Canvas (65%): n8n-style Dotted Workflow Canvas */}
      <div className="flex-[65] h-full relative border-r border-slate-5 bg-[#0F0F12]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          minZoom={0.3}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
          className="bg-[#0F0F12]"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="#27272A" />
          <Controls
            showInteractive={false}
            className="!bg-[#18181B] !border !border-[#27272A] !rounded-lg !shadow-xl !overflow-hidden [&>button]:!bg-[#18181B] [&>button]:!border-b-[#27272A] [&>button]:!text-white [&>button]:!fill-white [&>button:hover]:!bg-[#27272A]"
          />
        </ReactFlow>

        {/* Small legend badge on bottom right */}
        <div className="absolute bottom-3 right-3 bg-panel border border-slate-5 rounded-btn px-2.5 py-1 text-ui-xs text-slate-10 flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-9" /> Succeeded
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-9" /> Executing
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-9" /> Paused
          </span>
        </div>
      </div>

      {/* Right Column (35%): Pinned Decision Panel + Node Inspector */}
      <div className="flex-[35] h-full overflow-y-auto bg-panel flex flex-col p-4 space-y-4">
        {/* Pinned Decision Panel when waiting for approval */}
        {isWaitingApproval && (
          <ApprovalDecisionPanel run={run} />
        )}

        {/* Selected Node Inspector */}
        <div className="space-y-4">
          <div className="border-b border-slate-5 pb-3">
            <div className="text-ui-xs text-slate-10 uppercase tracking-wider font-semibold">
              Node Inspector
            </div>
            <div className="text-title-section text-slate-12 mt-1 flex items-center justify-between">
              <span>{selectedNode?.title || "Select a node"}</span>
              {selectedNode?.durationMs !== undefined && (
                <span className="font-mono text-ui-xs text-slate-10 font-normal flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {selectedNode.durationMs}ms
                </span>
              )}
            </div>
            <div className="font-mono text-ui-xs text-slate-10 mt-0.5">
              id: {selectedNode?.id}
            </div>
          </div>

          {selectedNode ? (
            <div className="space-y-4">
              {/* Grounding Verifier Citation Proof */}
              {selectedNode.groundingProof && (
                <div className="p-3 bg-slate-3 border border-slate-5 rounded-btn text-ui space-y-2">
                  <div className="flex items-center gap-1.5 text-green-11 font-medium text-ui-sm">
                    <ShieldCheck className="h-4 w-4 text-green-9" />
                    <span>Grounding Verification Proof (Zero Hallucination)</span>
                  </div>
                  <div className="space-y-1.5 text-ui-xs">
                    <div>
                      <span className="text-slate-10 block">Source Invoice PDF Quote:</span>
                      <blockquote className="p-2 rounded bg-slate-2 border-l-2 border-green-9 text-slate-12 font-mono text-[11px] italic">
                        "{selectedNode.groundingProof.sourceQuote}"
                      </blockquote>
                    </div>
                    <div className="flex justify-between text-slate-11 pt-1">
                      <span>Target Match:</span>
                      <span className="font-mono text-slate-12">{selectedNode.groundingProof.targetMatch}</span>
                    </div>
                    <div className="flex justify-between text-slate-11">
                      <span>Verbatim Similarity Confidence:</span>
                      <span className="font-mono text-green-11 font-medium">
                        {(selectedNode.groundingProof.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Deterministic Math Proof */}
              {selectedNode.mathProof && (
                <div className="p-3 bg-slate-3 border border-slate-5 rounded-btn text-ui space-y-2">
                  <div className="flex items-center gap-1.5 text-green-11 font-medium text-ui-sm">
                    <Calculator className="h-4 w-4 text-green-9" />
                    <span>Deterministic Math Proof (Decimal AST)</span>
                  </div>
                  <div className="space-y-1.5 text-ui-xs">
                    <div className="font-mono p-2 rounded bg-slate-2 text-slate-12 text-[11px]">
                      {selectedNode.mathProof.expression}
                    </div>
                    <div className="flex justify-between text-slate-11 pt-1">
                      <span>Exact Decimal Result:</span>
                      <span className="font-mono text-green-11 font-semibold text-ui">
                        ${selectedNode.mathProof.exactDecimalResult} USD
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-11">
                      <span>LLM Arithmetic Involved:</span>
                      <span className="font-mono text-slate-10">0.00% (AST Python Decimals)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Node Inputs */}
              {selectedNode.inputs && Object.keys(selectedNode.inputs).length > 0 && (
                <div>
                  <div className="text-ui-xs text-slate-10 font-semibold mb-1">Inputs</div>
                  <JsonViewer data={selectedNode.inputs} defaultExpanded={false} />
                </div>
              )}

              {/* Node Outputs */}
              {selectedNode.outputs && Object.keys(selectedNode.outputs).length > 0 && (
                <div>
                  <div className="text-ui-xs text-slate-10 font-semibold mb-1">Outputs</div>
                  <JsonViewer data={selectedNode.outputs} defaultExpanded={true} />
                </div>
              )}

              {/* Error Details */}
              {selectedNode.error && (
                <div className="p-3 bg-red-3 border border-red-6 rounded-btn text-ui-xs space-y-1">
                  <div className="font-medium text-red-12 flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 text-red-9" />
                    <span>Error Output</span>
                  </div>
                  <div className="font-mono text-red-11">{selectedNode.error}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-slate-10 text-ui-sm">
              Click any node in the graph to inspect inputs, outputs, and deterministic proofs.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

