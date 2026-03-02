"use client";
import { memo, useCallback, useMemo } from "react";

export type ObjectType = "card" | "deck" | "dice";

interface RadialAction {
  id: string;
  icon: string;
  label: string;
  onClick: () => void;
  color?: string;
}

interface RadialMenuProps {
  isOpen: boolean;
  onClose: () => void;
  position: { x: number; y: number };
  objectType: ObjectType;
  objectId: string;
  actions: {
    // Card actions
    onFlip?: () => void;
    onReturnToDeck?: () => void;
    // Deck actions
    onDraw?: () => void;
    onDrawMultiple?: (count: number) => void;
    onShuffle?: () => void;
    onDealToAll?: () => void;
    // Dice actions
    onRoll?: () => void;
    onRemove?: () => void;
  };
}

// Action button component
const ActionButton = memo(function ActionButton({
  action,
  angle,
  radius,
  onClose,
}: {
  action: RadialAction;
  angle: number;
  radius: number;
  onClose: () => void;
}) {
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;

  const handleClick = useCallback(() => {
    action.onClick();
    onClose();
  }, [action, onClose]);

  return (
    <button
      onClick={handleClick}
      className="absolute w-14 h-14 rounded-full text-white shadow-lg flex flex-col items-center justify-center hover:scale-110 active:scale-95 transition-all duration-150"
      style={{
        transform: `translate(${x}px, ${y}px)`,
        background: action.color ?? "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)",
        boxShadow: `0 4px 12px ${action.color ?? "#3B82F6"}40, 0 2px 4px rgba(0,0,0,0.3)`,
      }}
      title={action.label}
    >
      <span className="text-xl">{action.icon}</span>
      <span className="text-[10px] font-medium mt-0.5 opacity-90">{action.label}</span>
    </button>
  );
});

export function RadialMenu({ isOpen, onClose, position, objectType, actions }: RadialMenuProps) {
  // Build actions based on object type
  const radialActions = useMemo(() => {
    const actionList: RadialAction[] = [];

    if (objectType === "card") {
      if (actions.onFlip) {
        actionList.push({
          id: "flip",
          icon: "🔄",
          label: "Flip",
          onClick: actions.onFlip,
          color: "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)",
        });
      }
      if (actions.onReturnToDeck) {
        actionList.push({
          id: "return",
          icon: "📥",
          label: "Return",
          onClick: actions.onReturnToDeck,
          color: "linear-gradient(135deg, #6B7280 0%, #374151 100%)",
        });
      }
    }

    if (objectType === "deck") {
      if (actions.onDraw) {
        actionList.push({
          id: "draw",
          icon: "👆",
          label: "Draw",
          onClick: actions.onDraw,
          color: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
        });
      }
      if (actions.onDrawMultiple) {
        actionList.push({
          id: "draw5",
          icon: "🃏",
          label: "Draw 5",
          onClick: () => actions.onDrawMultiple!(5),
          color: "linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)",
        });
      }
      if (actions.onShuffle) {
        actionList.push({
          id: "shuffle",
          icon: "🔀",
          label: "Shuffle",
          onClick: actions.onShuffle,
          color: "linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)",
        });
      }
      if (actions.onDealToAll) {
        actionList.push({
          id: "deal",
          icon: "🎴",
          label: "Deal",
          onClick: actions.onDealToAll,
          color: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
        });
      }
    }

    if (objectType === "dice") {
      if (actions.onRoll) {
        actionList.push({
          id: "roll",
          icon: "🎲",
          label: "Roll",
          onClick: actions.onRoll,
          color: "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",
        });
      }
      if (actions.onRemove) {
        actionList.push({
          id: "remove",
          icon: "🗑️",
          label: "Remove",
          onClick: actions.onRemove,
          color: "linear-gradient(135deg, #6B7280 0%, #374151 100%)",
        });
      }
    }

    return actionList;
  }, [objectType, actions]);

  if (!isOpen) return null;

  // Calculate angles for each action
  const angleStep = radialActions.length > 0 ? (2 * Math.PI) / radialActions.length : 0;
  const startAngle = -Math.PI / 2; // Start from top
  const radius = 70;

  return (
    <>
      {/* Backdrop to catch clicks outside */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        role="button"
        tabIndex={0}
        aria-label="Close radial menu"
      />

      {/* Menu container */}
      <div
        className="fixed z-50 pointer-events-auto"
        style={{
          left: position.x,
          top: position.y,
          transform: "translate(-50%, -50%)",
        }}
      >
        {/* Radial background with glass effect */}
        <div
          className="absolute inset-0 w-44 h-44 rounded-full -translate-x-1/2 -translate-y-1/2"
          style={{
            background:
              "radial-gradient(circle, rgba(0,0,0,0.7) 20%, rgba(0,0,0,0.3) 60%, transparent 100%)",
            backdropFilter: "blur(8px)",
          }}
        />

        {/* Center close button */}
        <button
          onClick={onClose}
          className="absolute w-12 h-12 -translate-x-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-full text-white/80 hover:text-white flex items-center justify-center transition-all border border-white/10"
        >
          <span className="text-lg">✕</span>
        </button>

        {/* Action buttons arranged radially */}
        <div className="relative">
          {radialActions.map((action, index) => {
            const angle = startAngle + index * angleStep;
            return (
              <ActionButton
                key={action.id}
                action={action}
                angle={angle}
                radius={radius}
                onClose={onClose}
              />
            );
          })}
        </div>
      </div>
    </>
  );
}

// 3D version that can be attached to objects via Html from drei
export const RadialMenu3D = memo(function RadialMenu3D({
  objectType,
  objectId,
  actions,
  onClose,
}: Omit<RadialMenuProps, "isOpen" | "position"> & { onClose: () => void }) {
  // Build actions based on object type
  const radialActions = useMemo(() => {
    const actionList: RadialAction[] = [];

    if (objectType === "card") {
      if (actions.onFlip) {
        actionList.push({
          id: "flip",
          icon: "🔄",
          label: "Flip",
          onClick: actions.onFlip,
          color: "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)",
        });
      }
      if (actions.onReturnToDeck) {
        actionList.push({
          id: "return",
          icon: "📥",
          label: "Return",
          onClick: actions.onReturnToDeck,
          color: "linear-gradient(135deg, #6B7280 0%, #374151 100%)",
        });
      }
    }

    if (objectType === "deck") {
      if (actions.onDraw) {
        actionList.push({
          id: "draw",
          icon: "👆",
          label: "Draw",
          onClick: actions.onDraw,
          color: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
        });
      }
      if (actions.onDrawMultiple) {
        actionList.push({
          id: "draw5",
          icon: "🃏",
          label: "Draw 5",
          onClick: () => actions.onDrawMultiple!(5),
          color: "linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)",
        });
      }
      if (actions.onShuffle) {
        actionList.push({
          id: "shuffle",
          icon: "🔀",
          label: "Shuffle",
          onClick: actions.onShuffle,
          color: "linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)",
        });
      }
      if (actions.onDealToAll) {
        actionList.push({
          id: "deal",
          icon: "🎴",
          label: "Deal",
          onClick: actions.onDealToAll,
          color: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
        });
      }
    }

    if (objectType === "dice") {
      if (actions.onRoll) {
        actionList.push({
          id: "roll",
          icon: "🎲",
          label: "Roll",
          onClick: actions.onRoll,
          color: "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",
        });
      }
      if (actions.onRemove) {
        actionList.push({
          id: "remove",
          icon: "🗑️",
          label: "Remove",
          onClick: actions.onRemove,
          color: "linear-gradient(135deg, #6B7280 0%, #374151 100%)",
        });
      }
    }

    return actionList;
  }, [objectType, actions]);

  // Calculate angles for each action
  const angleStep = radialActions.length > 0 ? (2 * Math.PI) / radialActions.length : 0;
  const startAngle = -Math.PI / 2; // Start from top
  const radius = 60;

  return (
    <div className="relative pointer-events-auto" data-testid={`radial-menu-${objectId}`}>
      {/* Radial background with glass effect */}
      <div
        className="absolute w-36 h-36 rounded-full -translate-x-1/2 -translate-y-1/2"
        style={{
          background:
            "radial-gradient(circle, rgba(0,0,0,0.8) 20%, rgba(0,0,0,0.4) 60%, transparent 100%)",
          backdropFilter: "blur(8px)",
        }}
      />

      {/* Center close button */}
      <button
        onClick={onClose}
        className="absolute w-10 h-10 -translate-x-1/2 -translate-y-1/2 bg-black/70 hover:bg-black/90 backdrop-blur-md rounded-full text-white/80 hover:text-white flex items-center justify-center transition-all border border-white/10"
      >
        <span className="text-base">✕</span>
      </button>

      {/* Action buttons arranged radially */}
      {radialActions.map((action, index) => {
        const angle = startAngle + index * angleStep;
        return (
          <ActionButton
            key={action.id}
            action={action}
            angle={angle}
            radius={radius}
            onClose={onClose}
          />
        );
      })}
    </div>
  );
});
