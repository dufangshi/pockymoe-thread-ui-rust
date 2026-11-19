import {
  useI18n
} from "./chunk-26NJDTYG.js";
import "./chunk-7O5E2ZHX.js";

// src/components/graph-chat/GraphVisualization.tsx
import { useCallback, useEffect, useMemo } from "react";
import {
  addEdge,
  Background,
  Controls,
  Handle,
  MarkerType as MarkerType2,
  Position as Position4,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

// src/components/graph-chat/FloatingConnectionLine.tsx
import { getBezierPath } from "@xyflow/react";

// src/components/graph-chat/FloatingHelper.tsx
import { MarkerType, Position } from "@xyflow/react";
import { jsx, jsxs } from "react/jsx-runtime";
function getNodeIntersection(intersectionNode, targetNode) {
  const intersectionNodeWidth = Math.max(intersectionNode.measured.width ?? 1, 1);
  const intersectionNodeHeight = Math.max(
    intersectionNode.measured.height ?? 1,
    1
  );
  const intersectionNodePosition = intersectionNode.internals.positionAbsolute;
  const targetPosition = targetNode.internals.positionAbsolute;
  const targetNodeWidth = Math.max(targetNode.measured.width ?? 1, 1);
  const targetNodeHeight = Math.max(targetNode.measured.height ?? 1, 1);
  const w = intersectionNodeWidth / 2;
  const h = intersectionNodeHeight / 2;
  const x2 = intersectionNodePosition.x + w;
  const y2 = intersectionNodePosition.y + h;
  const x1 = targetPosition.x + targetNodeWidth / 2;
  const y1 = targetPosition.y + targetNodeHeight / 2;
  const xx1 = (x1 - x2) / (2 * w) - (y1 - y2) / (2 * h);
  const yy1 = (x1 - x2) / (2 * w) + (y1 - y2) / (2 * h);
  const a = 1 / (Math.abs(xx1) + Math.abs(yy1));
  const xx3 = a * xx1;
  const yy3 = a * yy1;
  const x = w * (xx3 + yy3) + x2;
  const y = h * (-xx3 + yy3) + y2;
  return { x, y };
}
function getEdgePosition(node, intersectionPoint) {
  const n = { ...node.internals.positionAbsolute, ...node };
  const nx = Math.round(n.x);
  const ny = Math.round(n.y);
  const px = Math.round(intersectionPoint.x);
  const py = Math.round(intersectionPoint.y);
  if (px <= nx + 1) {
    return Position.Left;
  }
  if (px >= nx + (node.measured.width ?? 1) - 1) {
    return Position.Right;
  }
  if (py <= ny + 1) {
    return Position.Top;
  }
  if (py >= n.y + (node.measured.height ?? 1) - 1) {
    return Position.Bottom;
  }
  return Position.Top;
}
function getEdgeParams(source, target) {
  const sourceIntersectionPoint = getNodeIntersection(source, target);
  const targetIntersectionPoint = getNodeIntersection(target, source);
  const sourcePos = getEdgePosition(source, sourceIntersectionPoint);
  const targetPos = getEdgePosition(target, targetIntersectionPoint);
  return {
    sx: sourceIntersectionPoint.x,
    sy: sourceIntersectionPoint.y,
    tx: targetIntersectionPoint.x,
    ty: targetIntersectionPoint.y,
    sourcePos,
    targetPos
  };
}
function buildGraph(inputNodes, width = 900, height = 620) {
  if (!inputNodes || !Array.isArray(inputNodes)) {
    return { nodes: [], edges: [] };
  }
  const forceLayout = (nodes2, edges2, layoutWidth, layoutHeight) => {
    const nodePositions = /* @__PURE__ */ new Map();
    const nodeCount = nodes2.length;
    nodes2.forEach((node, index) => {
      const hash = node.id.split("").reduce((value, character) => {
        const nextValue = (value << 5) - value + character.charCodeAt(0);
        return nextValue & nextValue;
      }, 0);
      nodePositions.set(node.id, {
        x: Math.abs(hash) % layoutWidth + index * 100 % layoutWidth,
        y: Math.abs(hash >> 16) % layoutHeight + index * 150 % layoutHeight,
        vx: 0,
        vy: 0
      });
    });
    for (let iteration = 0; iteration < 200; iteration += 1) {
      for (let i = 0; i < nodeCount; i += 1) {
        for (let j = i + 1; j < nodeCount; j += 1) {
          const firstNode = nodes2[i];
          const secondNode = nodes2[j];
          if (!firstNode || !secondNode) {
            continue;
          }
          const pos1 = nodePositions.get(firstNode.id);
          const pos2 = nodePositions.get(secondNode.id);
          if (!pos1 || !pos2) {
            continue;
          }
          const dx = pos1.x - pos2.x;
          const dy = pos1.y - pos2.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          const optimalDistance = 200;
          const force = (optimalDistance - distance) * 0.5;
          const fx = dx / distance * force;
          const fy = dy / distance * force;
          pos1.vx += fx;
          pos1.vy += fy;
          pos2.vx -= fx;
          pos2.vy -= fy;
        }
      }
      edges2.forEach((edge) => {
        const pos1 = nodePositions.get(edge.source);
        const pos2 = nodePositions.get(edge.target);
        if (!pos1 || !pos2) {
          return;
        }
        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        const targetLength = 120;
        const springForce = (distance - targetLength) * 0.3;
        const fx = dx / distance * springForce;
        const fy = dy / distance * springForce;
        pos1.vx += fx;
        pos1.vy += fy;
        pos2.vx -= fx;
        pos2.vy -= fy;
      });
      nodePositions.forEach((position) => {
        position.x += position.vx * 0.1;
        position.y += position.vy * 0.1;
        position.vx *= 0.9;
        position.vy *= 0.9;
        position.x = Math.max(80, Math.min(layoutWidth - 80, position.x));
        position.y = Math.max(80, Math.min(layoutHeight - 80, position.y));
      });
    }
    return nodePositions;
  };
  const inputIds = new Set(inputNodes.map((node) => node.id));
  const edges = [];
  inputNodes.forEach((node) => {
    if (!node.out_node_id) {
      return;
    }
    const outNodes = Array.isArray(node.out_node_id) ? node.out_node_id : [node.out_node_id];
    outNodes.forEach((outNodeId) => {
      if (!inputIds.has(outNodeId)) {
        return;
      }
      edges.push({
        id: `${node.id}-${outNodeId}`,
        source: node.id,
        target: outNodeId,
        type: "floating",
        sourceHandle: null,
        targetHandle: null,
        markerEnd: { type: MarkerType.Arrow }
      });
    });
  });
  const positions = forceLayout(inputNodes, edges, width, height);
  const nodes = inputNodes.map((node) => ({
    id: node.id,
    type: "styledNode",
    position: positions.get(node.id) ?? { x: 100, y: 100 },
    data: {
      label: /* @__PURE__ */ jsxs("div", { className: "text-center", children: [
        /* @__PURE__ */ jsx("div", { className: "text-sm font-semibold", children: node.name }),
        node.description ? /* @__PURE__ */ jsx("div", { className: "mt-1 max-w-32 overflow-hidden text-ellipsis text-xs text-slate-500 dark:text-slate-400", children: node.description }) : null
      ] })
    }
  }));
  return { nodes, edges };
}

// src/components/graph-chat/FloatingConnectionLine.tsx
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
function FloatingConnectionLine({
  toX,
  toY,
  fromPosition,
  toPosition,
  fromNode
}) {
  useI18n();
  if (!fromNode) {
    return null;
  }
  const targetNode = {
    id: "connection-target",
    measured: {
      width: 1,
      height: 1
    },
    internals: {
      positionAbsolute: { x: toX, y: toY }
    }
  };
  const { sx, sy, tx, ty, sourcePos, targetPos } = getEdgeParams(
    fromNode,
    targetNode
  );
  const [edgePath] = getBezierPath({
    sourceX: sx,
    sourceY: sy,
    sourcePosition: sourcePos || fromPosition,
    targetPosition: targetPos || toPosition,
    targetX: tx || toX,
    targetY: ty || toY
  });
  return /* @__PURE__ */ jsxs2("g", { children: [
    /* @__PURE__ */ jsx2(
      "path",
      {
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 1.5,
        className: "animated",
        d: edgePath
      }
    ),
    /* @__PURE__ */ jsx2(
      "circle",
      {
        cx: tx || toX,
        cy: ty || toY,
        fill: "var(--theme-panel)",
        r: 3,
        stroke: "currentColor",
        strokeWidth: 1.5
      }
    )
  ] });
}

// src/components/graph-chat/FloatingEdge.tsx
import { getBezierPath as getBezierPath2, useInternalNode } from "@xyflow/react";
import { jsx as jsx3 } from "react/jsx-runtime";
function FloatingEdge({
  id,
  source,
  target,
  markerEnd,
  style
}) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode) {
    return null;
  }
  const { sx, sy, tx, ty, sourcePos, targetPos } = getEdgeParams(
    sourceNode,
    targetNode
  );
  const [edgePath] = getBezierPath2({
    sourceX: sx,
    sourceY: sy,
    sourcePosition: sourcePos,
    targetPosition: targetPos,
    targetX: tx,
    targetY: ty
  });
  return /* @__PURE__ */ jsx3(
    "path",
    {
      id,
      className: "react-flow__edge-path",
      d: edgePath,
      markerEnd,
      style
    }
  );
}

// src/components/graph-chat/GraphVisualization.tsx
import { jsx as jsx4, jsxs as jsxs3 } from "react/jsx-runtime";
function GraphVisualization({ nodes: inputNodes }) {
  useI18n();
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState([]);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState([]);
  const graph = useMemo(() => buildGraph(inputNodes), [inputNodes]);
  const edgeTypes = useMemo(() => ({ floating: FloatingEdge }), []);
  const nodeTypes = useMemo(
    () => ({
      styledNode: ({ data, isConnectable }) => /* @__PURE__ */ jsxs3("div", { className: "thread-graph-flow-node", children: [
        data.label,
        /* @__PURE__ */ jsx4(
          Handle,
          {
            type: "target",
            position: Position4.Top,
            isConnectable,
            style: { opacity: 0, pointerEvents: "none" }
          }
        ),
        /* @__PURE__ */ jsx4(
          Handle,
          {
            type: "source",
            position: Position4.Bottom,
            isConnectable,
            style: { opacity: 0, pointerEvents: "none" }
          }
        )
      ] })
    }),
    []
  );
  useEffect(() => {
    setFlowNodes(graph.nodes);
    setFlowEdges(graph.edges);
  }, [graph.edges, graph.nodes, setFlowEdges, setFlowNodes]);
  const onConnect = useCallback(
    (params) => setFlowEdges(
      (edges) => addEdge(
        {
          ...params,
          type: "floating",
          sourceHandle: null,
          targetHandle: null,
          markerEnd: { type: MarkerType2.Arrow }
        },
        edges
      )
    ),
    [setFlowEdges]
  );
  return /* @__PURE__ */ jsx4("div", { className: "thread-graph-flow h-full min-h-0", children: /* @__PURE__ */ jsx4(ReactFlowProvider, { children: /* @__PURE__ */ jsxs3(
    ReactFlow,
    {
      nodes: flowNodes,
      edges: flowEdges,
      onNodesChange,
      onEdgesChange,
      onConnect,
      fitView: true,
      nodeTypes,
      edgeTypes,
      connectionLineComponent: FloatingConnectionLine,
      children: [
        /* @__PURE__ */ jsx4(Controls, {}),
        /* @__PURE__ */ jsx4(Background, { gap: 16 })
      ]
    }
  ) }) });
}
export {
  GraphVisualization
};
