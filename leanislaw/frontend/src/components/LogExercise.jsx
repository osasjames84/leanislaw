import { useState, useEffect, useRef } from "react";
import { useUnits } from "../contexts/UnitsContext";
import { formatExerciseWeightKg, parseExerciseWeightToKg } from "../units";

const LogExercise = ({ log, onDelete, onSetsChange }) => {
    const { units } = useUnits();
    const normalizeSets = (rawSets) => {
        const base =
            Array.isArray(rawSets) && rawSets.length > 0
                ? rawSets
                : [{ weight: "", reps: "", rpe: "" }];
        return base.map((s) => ({
            weight: s.weight ?? "",
            reps: s.reps ?? "",
            rpe: s.rpe ?? "",
            isDone: Boolean(s.isDone),
            restEndTime: s.restEndTime ?? null,
            restDurationMs: s.restDurationMs ?? null,
        }));
    };

    const [sets, setSets] = useState(normalizeSets(log.sets));
    const [restMinutes, setRestMinutes] = useState(2);
    const [now, setNow] = useState(Date.now());
    const [menuOpen, setMenuOpen] = useState(false);
    const noteKey = `leanislaw:lognote:${log.id}`;
    const [note, setNote] = useState(() => {
        try {
            return sessionStorage.getItem(noteKey) ?? "";
        } catch {
            return "";
        }
    });
    const menuRef = useRef(null);

    useEffect(() => {
        try {
            sessionStorage.setItem(noteKey, note);
        } catch {
            /* ignore */
        }
    }, [noteKey, note]);

    useEffect(() => {
        const interval = setInterval(() => {
            setNow(Date.now());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const onDoc = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", onDoc);
        return () => document.removeEventListener("mousedown", onDoc);
    }, []);

    useEffect(() => {
        if (typeof onSetsChange === "function") {
            onSetsChange(log.id, sets);
        }
    }, [sets, log.id, onSetsChange]);

    const handleAddSet = () => {
        setSets([
            ...sets,
            {
                weight: "",
                reps: "",
                rpe: "",
                isDone: false,
                restEndTime: null,
                restDurationMs: null,
            },
        ]);
    };

    const updateSetData = (indexToUpdate, field, value) => {
        setSets((prevSets) =>
            prevSets.map((s, index) =>
                index === indexToUpdate ? { ...s, [field]: value } : s
            )
        );
    };

    const toggleSetDone = (indexToUpdate, checked) => {
        const durationMs = Number(restMinutes) > 0 ? Number(restMinutes) * 60 * 1000 : 0;
        const targetEnd = checked && durationMs > 0 ? Date.now() + durationMs : null;

        setSets((prevSets) =>
            prevSets.map((s, index) =>
                index === indexToUpdate
                    ? {
                          ...s,
                          isDone: checked,
                          restEndTime: targetEnd,
                          restDurationMs: checked ? durationMs : null,
                      }
                    : s
            )
        );
    };

    const formatRemaining = (endTime) => {
        if (!endTime) return null;
        const diff = Math.max(0, Math.floor((endTime - now) / 1000));
        const minutes = Math.floor(diff / 60);
        const seconds = diff % 60;
        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    };

    const formatConfiguredRest = () => {
        const mins = Math.max(0, Number(restMinutes) || 0);
        return `${mins}:${String(0).padStart(2, "0")}`;
    };

    const getTimerLabel = (set) => {
        if (set.restEndTime) {
            const live = formatRemaining(set.restEndTime);
            if (live) return live;
            return "0:00";
        }
        return formatConfiguredRest();
    };

    const restLabelForBetweenSets = (set) => getTimerLabel(set);

    const weightUnit = units === "imperial" ? "lb" : "kg";

    return (
        <div style={containerStyle}>
            <div style={headRowStyle}>
                <h4 style={titleStyle}>{log.name}</h4>
                <div style={headActionsStyle}>
                    <button
                        type="button"
                        style={iconBtnStyle}
                        aria-label="Link"
                        title="Superset / history"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                        </svg>
                    </button>
                    <div style={{ position: "relative" }} ref={menuRef}>
                        <button
                            type="button"
                            style={iconBtnStyle}
                            aria-expanded={menuOpen}
                            aria-label="Exercise menu"
                            onClick={() => setMenuOpen((o) => !o)}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <circle cx="5" cy="12" r="2" />
                                <circle cx="12" cy="12" r="2" />
                                <circle cx="19" cy="12" r="2" />
                            </svg>
                        </button>
                        {menuOpen ? (
                            <div style={dropdownStyle}>
                                <label style={restMenuRowStyle}>
                                    Rest between sets
                                    <input
                                        type="number"
                                        min="0"
                                        value={restMinutes}
                                        onChange={(e) => setRestMinutes(e.target.value)}
                                        style={restInputStyle}
                                    />
                                    <span style={{ opacity: 0.7 }}>min</span>
                                </label>
                                <button
                                    type="button"
                                    style={dropdownDangerStyle}
                                    onClick={() => {
                                        setMenuOpen(false);
                                        onDelete(log.id);
                                    }}
                                >
                                    Remove exercise
                                </button>
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>

            <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Notes"
                style={noteInputStyle}
            />

            <div style={setsTableScrollStyle}>
                <div style={setsTableInnerStyle}>
                    <div style={gridHeaderStyle}>
                        <div>Set</div>
                        <div>Previous</div>
                        <div>{weightUnit}</div>
                        <div>Reps</div>
                        <div style={{ textAlign: "center" }}>RPE</div>
                        <div style={{ justifySelf: "center" }}>
                            <span style={checkColHeadStyle}>✓</span>
                        </div>
                    </div>

            {sets.map((set, index) => (
                <div key={index}>
                    <div style={gridRowStyle}>
                        <div style={setNumStyle}>{index + 1}</div>
                        <div style={previousCellStyle}>—</div>
                        <input
                            type="number"
                            step="any"
                            inputMode="decimal"
                            value={formatExerciseWeightKg(set.weight, units)}
                            onChange={(e) =>
                                updateSetData(
                                    index,
                                    "weight",
                                    parseExerciseWeightToKg(e.target.value, units)
                                )
                            }
                            placeholder="0"
                            style={inputStyle}
                        />
                        <input
                            type="number"
                            inputMode="numeric"
                            value={set.reps}
                            onChange={(e) => updateSetData(index, "reps", e.target.value)}
                            placeholder="0"
                            style={inputStyle}
                        />
                        <input
                            type="number"
                            inputMode="decimal"
                            value={set.rpe}
                            onChange={(e) => updateSetData(index, "rpe", e.target.value)}
                            placeholder="—"
                            aria-label={`Set ${index + 1} RPE`}
                            style={rpeInputStyle}
                        />
                        <div style={{ display: "flex", justifyContent: "center" }}>
                            <button
                                type="button"
                                style={getDoneBtnStyle(!!set.isDone)}
                                aria-pressed={!!set.isDone}
                                aria-label={set.isDone ? "Set complete" : "Mark set complete"}
                                onClick={() => toggleSetDone(index, !set.isDone)}
                            >
                                {set.isDone ? "✓" : ""}
                            </button>
                        </div>
                    </div>
                    {index < sets.length - 1 ? (
                        <div style={restLineWrapStyle}>
                            <div style={restLineSegStyle} />
                            <span style={restLineTextStyle}>{restLabelForBetweenSets(set)}</span>
                            <div style={restLineSegStyle} />
                        </div>
                    ) : null}
                </div>
            ))}
                </div>
            </div>

            <button type="button" onClick={handleAddSet} style={addSetBtnStyle}>
                + Add Set ({formatConfiguredRest()})
            </button>
        </div>
    );
};

const appFont = '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';

const containerStyle = {
    borderRadius: 0,
    padding:
        "14px max(12px, env(safe-area-inset-left, 0px)) 16px max(12px, env(safe-area-inset-right, 0px))",
    marginBottom: 0,
    backgroundColor: "#fff",
    maxWidth: "100%",
    boxSizing: "border-box",
    border: "none",
    borderBottom: "0.5px solid #d1d1d6",
    fontFamily: appFont,
};

const headRowStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 8,
};

const titleStyle = {
    margin: 0,
    fontSize: "1.02rem",
    fontWeight: 800,
    color: "#007aff",
    lineHeight: 1.25,
    flex: 1,
    minWidth: 0,
};

const headActionsStyle = { display: "flex", alignItems: "center", gap: 2, flexShrink: 0 };

const iconBtnStyle = {
    background: "transparent",
    border: "none",
    color: "#007aff",
    cursor: "pointer",
    padding: 6,
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
};

const dropdownStyle = {
    position: "absolute",
    right: 0,
    top: "100%",
    marginTop: 4,
    minWidth: 200,
    backgroundColor: "#fff",
    borderRadius: 10,
    border: "0.5px solid #d1d1d6",
    boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
    padding: 10,
    zIndex: 50,
};

const restMenuRowStyle = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: "0.8rem",
    color: "#1c1c1e",
    marginBottom: 10,
    flexWrap: "wrap",
};

const restInputStyle = {
    width: 48,
    padding: "4px 6px",
    borderRadius: 6,
    border: "1px solid #d1d1d6",
    backgroundColor: "#fff",
    color: "#000",
    fontSize: "0.85rem",
};

const dropdownDangerStyle = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #ff3b30",
    background: "#fff5f5",
    color: "#ff3b30",
    fontWeight: 600,
    fontSize: "0.85rem",
    cursor: "pointer",
};

const noteInputStyle = {
    width: "100%",
    boxSizing: "border-box",
    marginBottom: 12,
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #e5e5ea",
    backgroundColor: "#f2f2f7",
    color: "#1c1c1e",
    fontSize: "0.85rem",
    outline: "none",
};

const setsTableScrollStyle = {
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
    marginLeft: "calc(-1 * max(12px, env(safe-area-inset-left, 0px)))",
    marginRight: "calc(-1 * max(12px, env(safe-area-inset-right, 0px)))",
    paddingLeft: "max(12px, env(safe-area-inset-left, 0px))",
    paddingRight: "max(12px, env(safe-area-inset-right, 0px))",
};

const setsTableInnerStyle = {
    minWidth: 340,
    boxSizing: "border-box",
};

const gridHeaderStyle = {
    display: "grid",
    gridTemplateColumns:
        "28px minmax(56px, 1fr) minmax(52px, 1fr) minmax(44px, 1fr) minmax(48px, 56px) 40px",
    gap: 6,
    marginBottom: 10,
    fontWeight: 600,
    fontSize: "0.65rem",
    color: "#8e8e93",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    alignItems: "end",
};

const gridRowStyle = {
    display: "grid",
    gridTemplateColumns:
        "28px minmax(56px, 1fr) minmax(52px, 1fr) minmax(44px, 1fr) minmax(48px, 56px) 40px",
    gap: 6,
    alignItems: "center",
    marginBottom: 4,
};

const setNumStyle = {
    textAlign: "center",
    fontWeight: 700,
    fontSize: "0.95rem",
    color: "#1c1c1e",
};

const previousCellStyle = {
    fontSize: "0.85rem",
    color: "#636366",
    fontVariantNumeric: "tabular-nums",
};

const inputStyle = {
    width: "100%",
    padding: "8px 6px",
    borderRadius: 8,
    border: "1px solid #d1d1d6",
    backgroundColor: "#fff",
    color: "#000",
    fontSize: "0.95rem",
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
    boxSizing: "border-box",
};

const rpeInputStyle = {
    ...inputStyle,
    padding: "8px 4px",
    fontSize: "0.85rem",
    textAlign: "center",
};

const checkColHeadStyle = {
    fontSize: "0.85rem",
    color: "#8e8e93",
};

function getDoneBtnStyle(done) {
    return {
        width: 32,
        height: 32,
        borderRadius: 6,
        border: done ? "none" : "1px solid #c7c7cc",
        backgroundColor: done ? "#000" : "transparent",
        color: done ? "#fff" : "transparent",
        cursor: "pointer",
        fontSize: "1rem",
        fontWeight: 800,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        lineHeight: 1,
    };
}

const restLineWrapStyle = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    margin: "10px 0 12px",
};

const restLineSegStyle = {
    flex: 1,
    height: 2,
    backgroundColor: "#007aff",
    borderRadius: 1,
    opacity: 0.9,
};

const restLineTextStyle = {
    fontSize: "0.8rem",
    fontWeight: 700,
    color: "#007aff",
    fontVariantNumeric: "tabular-nums",
    minWidth: "2.5rem",
    textAlign: "center",
};

const addSetBtnStyle = {
    width: "100%",
    marginTop: 6,
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid #d1d1d6",
    backgroundColor: "#f2f2f7",
    color: "#1c1c1e",
    fontWeight: 700,
    fontSize: "0.95rem",
    cursor: "pointer",
};

export default LogExercise;
