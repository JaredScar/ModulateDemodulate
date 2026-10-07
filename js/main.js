"use strict";

// Levels match the README figure: V+ = 0.50, zero = 0.00, V- = -0.50.
// Manchester follows that figure: a 0 falls mid-bit, and a 1 rises mid-bit.
const V_PLUS = 0.5;
const V_ZERO = 0;
const V_MINUS = -0.5;
const RAIL_TOLERANCE = 0.2;

const SCHEMES = [
    {
        id: "nrz-unipolar",
        name: "NRZ unipolar",
        samplesPerBit: 1,
        rails: [V_PLUS, V_ZERO],
        hints: ["1 holds 0.50", "0 holds 0.00", "8 samples per byte"],
        detail: "A 1 stays at 0.50 for the whole bit. A 0 stays at 0.00. The level does not return to zero in the middle of a 1.",
        encodeBit(bit) {
            return [bit === "1" ? V_PLUS : V_ZERO];
        },
        decodeBit(samples) {
            return snapRail(samples[0], this.rails) === V_PLUS ? "1" : "0";
        }
    },
    {
        id: "nrz-bipolar",
        name: "NRZ bipolar",
        samplesPerBit: 1,
        rails: [V_PLUS, V_ZERO, V_MINUS],
        hints: ["1 holds 0.50", "0 holds -0.50", "8 samples per byte"],
        detail: "A 1 stays at 0.50 for the whole bit. A 0 stays at -0.50. The line does not rest at 0.00 during a bit.",
        encodeBit(bit) {
            return [bit === "1" ? V_PLUS : V_MINUS];
        },
        decodeBit(samples) {
            const level = snapRail(samples[0], this.rails);
            if (level === V_PLUS) return "1";
            if (level === V_MINUS) return "0";
            throw new Error("NRZ bipolar uses 0.50 for a 1 and -0.50 for a 0.");
        }
    },
    {
        id: "rz-unipolar",
        name: "RZ unipolar",
        samplesPerBit: 2,
        rails: [V_PLUS, V_ZERO],
        hints: ["1 pulses 0.50, then 0", "0 stays 0.00", "16 samples per byte"],
        detail: "A 1 rises to 0.50 for the first half of the bit, then returns to 0.00. A 0 stays at 0.00 for both halves.",
        encodeBit(bit) {
            return bit === "1" ? [V_PLUS, V_ZERO] : [V_ZERO, V_ZERO];
        },
        decodeBit(samples) {
            return snapRail(samples[0], this.rails) === V_PLUS ? "1" : "0";
        }
    },
    {
        id: "rz-bipolar",
        name: "RZ bipolar",
        samplesPerBit: 2,
        rails: [V_PLUS, V_ZERO, V_MINUS],
        hints: ["1 pulses 0.50", "0 pulses -0.50", "both return to 0", "16 samples per byte"],
        detail: "A 1 pulses to 0.50 for the first half of the bit, then returns to 0.00. A 0 pulses to -0.50 for the first half, then returns to 0.00.",
        encodeBit(bit) {
            return bit === "1" ? [V_PLUS, V_ZERO] : [V_MINUS, V_ZERO];
        },
        decodeBit(samples) {
            const level = snapRail(samples[0], this.rails);
            if (level === V_PLUS) return "1";
            if (level === V_MINUS) return "0";
            throw new Error("RZ bipolar needs a 0.50 or -0.50 pulse in the first half of each bit.");
        }
    },
    {
        id: "manchester",
        name: "Manchester",
        samplesPerBit: 2,
        rails: [V_PLUS, V_ZERO],
        hints: ["0 falls mid-bit", "1 rises mid-bit", "16 samples per byte"],
        detail: "Every bit changes in the middle. A 0 goes from 0.50 to 0.00. A 1 goes from 0.00 to 0.50.",
        encodeBit(bit) {
            return bit === "1" ? [V_ZERO, V_PLUS] : [V_PLUS, V_ZERO];
        },
        decodeBit(samples) {
            const first = snapRail(samples[0], this.rails);
            const second = snapRail(samples[1], this.rails);
            if (first === V_PLUS && second === V_ZERO) return "0";
            if (first === V_ZERO && second === V_PLUS) return "1";
            throw new Error("Manchester needs a mid-bit transition: falling for 0, rising for 1.");
        }
    },
    {
        id: "nrzi",
        name: "NRZI",
        samplesPerBit: 1,
        rails: [V_PLUS, V_ZERO],
        hints: ["Starts at 0.00", "1 flips", "0 holds", "8 samples per byte"],
        detail: "The line starts at 0.00 before the first bit. A 1 flips the line between 0.00 and 0.50. A 0 leaves the line where it was.",
        encodeBit(bit, state) {
            if (bit === "1") {
                state.level = state.level === V_PLUS ? V_ZERO : V_PLUS;
            }
            return [state.level];
        },
        decodeBit(samples, state) {
            const level = snapRail(samples[0], this.rails);
            const changed = level !== state.level;
            state.level = level;
            return changed ? "1" : "0";
        }
    }
];

function getScheme(id) {
    const scheme = SCHEMES.find((item) => item.id === id);
    if (!scheme) {
        throw new Error("Unknown encoding scheme.");
    }
    return scheme;
}

function snapRail(value, rails) {
    const level = Number(value);
    if (value === null || value === "" || !Number.isFinite(level)) {
        throw new Error("Every voltage sample must be a number.");
    }
    let nearest = rails[0];
    let distance = Math.abs(level - nearest);
    for (let index = 1; index < rails.length; index += 1) {
        const gap = Math.abs(level - rails[index]);
        if (gap < distance) {
            nearest = rails[index];
            distance = gap;
        }
    }
    if (distance > RAIL_TOLERANCE) {
        throw new Error("Voltage " + level + " is not a level used by this scheme.");
    }
    return nearest;
}

function encodeText(text, schemeId) {
    const scheme = getScheme(schemeId);
    const bytes = Array.from(new TextEncoder().encode(String(text)));
    const binary = bytes.map((byte) => byte.toString(2).padStart(8, "0"));
    const state = { level: V_ZERO };
    const voltages = binary.map((bits) => {
        const samples = [];
        for (const bit of bits) {
            samples.push(...scheme.encodeBit(bit, state));
        }
        return samples;
    });
    return { bytes, binary, voltages };
}

function normalizeRows(value, samplesPerByte, schemeName) {
    const shapeError = schemeName + " voltages must be a JSON array of samples, or one array of " + samplesPerByte + " samples per byte.";
    if (!Array.isArray(value)) {
        throw new Error(shapeError);
    }
    if (value.length === 0) {
        return [];
    }
    if (value.every((item) => Array.isArray(item))) {
        return value;
    }
    if (value.every((item) => typeof item === "number" || typeof item === "string")) {
        if (value.length % samplesPerByte !== 0) {
            throw new Error("Each byte needs exactly " + samplesPerByte + " voltage samples for " + schemeName + ".");
        }
        const rows = [];
        for (let index = 0; index < value.length; index += samplesPerByte) {
            rows.push(value.slice(index, index + samplesPerByte));
        }
        return rows;
    }
    throw new Error(shapeError);
}

function decodeVoltages(value, schemeId) {
    const scheme = getScheme(schemeId);
    const samplesPerByte = scheme.samplesPerBit * 8;
    const rows = normalizeRows(value, samplesPerByte, scheme.name);
    const state = { level: V_ZERO };
    const bytes = [];

    for (const row of rows) {
        if (row.length === 0) {
            continue;
        }
        if (row.length !== samplesPerByte) {
            throw new Error("Each byte needs exactly " + samplesPerByte + " voltage samples for " + scheme.name + ".");
        }
        let bits = "";
        for (let index = 0; index < 8; index += 1) {
            const start = index * scheme.samplesPerBit;
            bits += scheme.decodeBit(row.slice(start, start + scheme.samplesPerBit), state);
        }
        bytes.push(Number.parseInt(bits, 2));
    }

    return new TextDecoder("utf-8", { fatal: false }).decode(Uint8Array.from(bytes));
}

function formatVoltages(voltages) {
    if (!voltages.length) {
        return "—";
    }
    const rows = voltages.map((row) => "  " + JSON.stringify(row));
    return "[\n" + rows.join(",\n") + "\n]";
}

globalThis.LineCodes = { encodeText, decodeVoltages, SCHEMES };

function drawWaveform(canvas, viewport, binaryGroups, voltageGroups, scheme) {
    const bits = binaryGroups.flatMap((group) => [...group]);
    const levels = voltageGroups.flat();
    const perBit = scheme.samplesPerBit;
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    const viewportWidth = Math.max(viewport.clientWidth, 280);
    const cssHeight = 240;
    const padL = 58;
    const padR = 16;
    const padT = 18;
    const padB = 36;
    const lead = levels.length ? 18 : 0;
    const rails = scheme.rails;
    const railMax = rails[0];
    const railMin = rails[rails.length - 1];

    let cssWidth = viewportWidth;
    let step = 0;
    if (levels.length) {
        const available = Math.max(viewportWidth - padL - padR - lead, 1);
        const minStep = perBit === 1 ? 18 : 12;
        const maxStep = perBit === 1 ? 64 : 36;
        step = levels.length * minStep <= available
            ? Math.min(maxStep, available / levels.length)
            : minStep;
        cssWidth = Math.max(viewportWidth, Math.ceil(padL + lead + step * levels.length + padR));
    }

    canvas.style.width = cssWidth + "px";
    canvas.style.height = cssHeight + "px";
    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    ctx.fillStyle = "#070a06";
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    const highY = padT + 16;
    const lowY = cssHeight - padB - 8;
    const plotBottom = cssHeight - padB;
    const plotRight = cssWidth - padR;
    const yFor = (value) => {
        const span = railMax - railMin || 1;
        const t = (value - railMin) / span;
        return lowY - t * (lowY - highY);
    };

    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(157, 255, 106, 0.07)";
    for (let x = padL; x <= plotRight; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, padT);
        ctx.lineTo(x + 0.5, plotBottom);
        ctx.stroke();
    }
    for (let y = padT; y <= plotBottom; y += 20) {
        ctx.beginPath();
        ctx.moveTo(padL, y + 0.5);
        ctx.lineTo(plotRight, y + 0.5);
        ctx.stroke();
    }

    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = "rgba(240, 193, 74, 0.55)";
    ctx.beginPath();
    rails.forEach((rail) => {
        const y = yFor(rail);
        ctx.moveTo(padL, y);
        ctx.lineTo(plotRight, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#f0c14a";
    ctx.font = "11px ui-monospace, Consolas, monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    rails.forEach((rail) => {
        ctx.fillText(rail.toFixed(2), padL - 8, yFor(rail));
    });

    canvas.setAttribute(
        "aria-label",
        levels.length
            ? scheme.name + " waveform, " + bits.length + " bits. " + scheme.detail
            : "Empty " + scheme.name + " waveform. Enter a message to draw it."
    );

    if (!levels.length) {
        ctx.fillStyle = "#a3b39a";
        ctx.font = "14px Segoe UI, system-ui, sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText("Enter a message to draw the waveform.", padL, (padT + plotBottom) / 2);
        return;
    }

    const origin = padL + lead;

    if (perBit > 1) {
        ctx.strokeStyle = "rgba(231, 240, 223, 0.14)";
        for (let bit = 1; bit < bits.length; bit += 1) {
            if (bit % 8 === 0) continue;
            const x = Math.round(origin + bit * perBit * step) + 0.5;
            ctx.beginPath();
            ctx.moveTo(x, highY);
            ctx.lineTo(x, lowY);
            ctx.stroke();
        }
    }

    ctx.save();
    ctx.strokeStyle = "rgba(240, 193, 74, 0.9)";
    ctx.setLineDash([2, 4]);
    const samplesPerByte = perBit * 8;
    for (let index = samplesPerByte; index < levels.length; index += samplesPerByte) {
        const x = Math.round(origin + index * step) + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, highY - 8);
        ctx.lineTo(x, lowY + 8);
        ctx.stroke();
    }
    ctx.restore();

    const trace = new Path2D();
    trace.moveTo(padL, yFor(V_ZERO));
    trace.lineTo(origin, yFor(V_ZERO));
    levels.forEach((level, index) => {
        const x0 = origin + index * step;
        const y = yFor(level);
        trace.lineTo(x0, y);
        trace.lineTo(x0 + step, y);
    });

    ctx.lineJoin = "miter";
    ctx.strokeStyle = "rgba(157, 255, 106, 0.28)";
    ctx.lineWidth = 7;
    ctx.stroke(trace);
    ctx.strokeStyle = "#e9ffd8";
    ctx.lineWidth = 2;
    ctx.stroke(trace);

    ctx.font = "12px ui-monospace, Consolas, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    bits.forEach((bit, index) => {
        ctx.fillStyle = bit === "1" ? "#9dff6a" : "#a3b39a";
        ctx.fillText(bit, origin + (index + 0.5) * perBit * step, cssHeight - 14);
    });
}

async function copyText(value) {
    try {
        await navigator.clipboard.writeText(value);
        return true;
    } catch {
        const area = document.createElement("textarea");
        area.value = value;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.append(area);
        area.select();
        let copied = false;
        try {
            copied = document.execCommand("copy");
        } catch {
            copied = false;
        }
        area.remove();
        return copied;
    }
}

function flash(button, ok, label) {
    button.textContent = ok ? "Copied" : "Copy failed";
    window.setTimeout(() => {
        button.textContent = label;
    }, 1400);
}

function boot() {
    const schemeOptions = document.querySelector("#scheme-options");
    const messageInput = document.querySelector("#message");
    const bytesLabel = document.querySelector("#bytes-label");
    const bytesOut = document.querySelector("#bytes-out");
    const binaryOut = document.querySelector("#binary-out");
    const voltageOut = document.querySelector("#voltage-out");
    const waveTitle = document.querySelector("#wave-title");
    const scopeHints = document.querySelector("#scope-hints");
    const schemeSummary = document.querySelector("#scheme-summary");
    const schemeDetail = document.querySelector("#scheme-detail");
    const canvas = document.querySelector("#waveform");
    const viewport = document.querySelector("#waveform-viewport");
    const sendButton = document.querySelector("#send-to-decode");
    const copyButton = document.querySelector("#copy-voltages");
    const decodeInput = document.querySelector("#voltages-in");
    const decodeOut = document.querySelector("#decoded-out");
    const decodeError = document.querySelector("#decode-error");
    const copyDecoded = document.querySelector("#copy-decoded");
    const scrollHint = document.querySelector("#scroll-hint");

    let voltages = [];
    let decodedText = "";
    let drawToken = 0;

    SCHEMES.forEach((scheme) => {
        const label = document.createElement("label");
        const input = document.createElement("input");
        input.type = "radio";
        input.name = "scheme";
        input.value = scheme.id;
        input.checked = scheme.id === "nrzi";
        label.append(input, document.createTextNode(scheme.name));
        schemeOptions.append(label);
    });

    function selectedScheme() {
        const selected = schemeOptions.querySelector("input:checked");
        return getScheme(selected ? selected.value : "nrzi");
    }

    function renderHints(scheme) {
        scopeHints.querySelectorAll("[data-hint]").forEach((node) => node.remove());
        scheme.hints.forEach((text) => {
            const span = document.createElement("span");
            span.dataset.hint = "true";
            span.textContent = text;
            scopeHints.insertBefore(span, scrollHint);
        });
        const boundary = document.createElement("span");
        boundary.dataset.hint = "true";
        boundary.textContent = "Amber marks byte boundaries";
        scopeHints.insertBefore(boundary, scrollHint);
    }

    function paint() {
        const scheme = selectedScheme();
        const encoded = encodeText(messageInput.value, scheme.id);
        drawWaveform(canvas, viewport, encoded.binary, encoded.voltages, scheme);
        scrollHint.hidden = canvas.offsetWidth <= viewport.clientWidth + 1;
    }

    function renderEncode() {
        const scheme = selectedScheme();
        const encoded = encodeText(messageInput.value, scheme.id);
        voltages = encoded.voltages;
        const asciiOnly = encoded.bytes.every((byte) => byte < 128);
        bytesLabel.textContent = asciiOnly ? "ASCII" : "UTF-8 bytes";
        bytesOut.textContent = encoded.bytes.length ? encoded.bytes.join(" ") : "—";
        binaryOut.textContent = encoded.binary.length ? encoded.binary.join(" ") : "—";
        voltageOut.textContent = formatVoltages(voltages);
        const hasTrace = voltages.length > 0;
        sendButton.disabled = !hasTrace;
        copyButton.disabled = !hasTrace;
        waveTitle.textContent = scheme.name + " waveform";
        schemeSummary.textContent = "How " + scheme.name + " works";
        schemeDetail.textContent = "The message is turned into UTF-8 bytes, then 8-bit groups. ASCII text is one byte per character. " + scheme.detail;
        decodeInput.placeholder = hasTrace
            ? formatVoltages(encodeText("A", scheme.id).voltages)
            : "Paste voltages for the selected scheme";
        renderHints(scheme);
        paint();
    }

    function scheduleDraw() {
        cancelAnimationFrame(drawToken);
        drawToken = requestAnimationFrame(paint);
    }

    function renderDecode() {
        const scheme = selectedScheme();
        const raw = decodeInput.value.trim();
        if (!raw) {
            decodedText = "";
            decodeError.textContent = "";
            decodeOut.textContent = "Paste a " + scheme.name + " voltage trace to recover the message.";
            decodeOut.classList.add("hint");
            copyDecoded.disabled = true;
            return;
        }

        try {
            decodedText = decodeVoltages(JSON.parse(raw), scheme.id);
            decodeError.textContent = "";
            decodeOut.textContent = decodedText.length ? decodedText : "(empty message)";
            decodeOut.classList.remove("hint");
            copyDecoded.disabled = decodedText.length === 0;
        } catch (error) {
            decodedText = "";
            decodeOut.textContent = "";
            decodeOut.classList.remove("hint");
            decodeError.textContent = error instanceof SyntaxError
                ? "That text is not valid JSON."
                : error.message;
            copyDecoded.disabled = true;
        }
    }

    messageInput.addEventListener("input", renderEncode);
    decodeInput.addEventListener("input", renderDecode);
    schemeOptions.addEventListener("change", () => {
        renderEncode();
        renderDecode();
    });

    sendButton.addEventListener("click", () => {
        decodeInput.value = formatVoltages(voltages);
        renderDecode();
        document.querySelector("#demodulate").scrollIntoView({ behavior: "smooth", block: "nearest" });
    });

    copyButton.addEventListener("click", async () => {
        const ok = await copyText(formatVoltages(voltages));
        flash(copyButton, ok, "Copy voltages");
    });

    copyDecoded.addEventListener("click", async () => {
        const ok = await copyText(decodedText);
        flash(copyDecoded, ok, "Copy message");
    });

    if (typeof ResizeObserver === "function") {
        new ResizeObserver(scheduleDraw).observe(viewport);
    } else {
        window.addEventListener("resize", scheduleDraw);
    }

    renderEncode();
}

if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
}
