/**
 * Renders remote collaborator cursors as an overlay inside the React Flow canvas.
 * Cursor positions are in flow-space coordinates (canvas space) and converted
 * to screen coordinates using the React Flow instance.
 */
import { useReactFlow } from "@xyflow/react";
import type { Collaborator } from "@/hooks/useCollaboration";

interface RemoteCursorsProps {
  collaborators: Collaborator[];
}

export function RemoteCursors({ collaborators }: RemoteCursorsProps) {
  const { flowToScreenPosition } = useReactFlow();

  return (
    <>
      {collaborators.map((c) => {
        if (!c.cursor) return null;

        let screenPos: { x: number; y: number };
        try {
          screenPos = flowToScreenPosition({ x: c.cursor.x, y: c.cursor.y });
        } catch {
          return null;
        }

        return (
          <div
            key={c.socketId}
            className="pointer-events-none select-none fixed z-50"
            style={{
              left: screenPos.x,
              top: screenPos.y,
              transform: "translate(-2px, -2px)",
              transition: "left 60ms linear, top 60ms linear",
            }}
          >
            {/* Cursor arrow */}
            <svg width="16" height="20" viewBox="0 0 16 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M0.5 0.5L0.5 14.5L4.5 10.5L7.5 17.5L9.5 16.5L6.5 9.5L11.5 9.5L0.5 0.5Z"
                fill={c.color}
                stroke="rgba(0,0,0,0.5)"
                strokeWidth="0.8"
              />
            </svg>
            {/* Name label */}
            <div
              className="text-[9px] font-bold text-white whitespace-nowrap px-1.5 py-0.5 rounded-full mt-0.5"
              style={{
                background: c.color,
                boxShadow: `0 1px 4px ${c.color}60`,
              }}
            >
              {c.name}
            </div>
          </div>
        );
      })}
    </>
  );
}

/**
 * Node selection ring — shown on nodes that a remote collaborator has selected.
 * Applied as an overlay on the canvas node.
 */
interface SelectionRingProps {
  collaborators: Collaborator[];
  nodeId: string;
}

export function getNodeSelectionColor(collaborators: Collaborator[], nodeId: string): string | null {
  const c = collaborators.find((u) => u.selectedNodeId === nodeId);
  return c ? c.color : null;
}
