"use strict";

// NRZI-M: a 1 flips the line between LOW and HIGH. A 0 holds the previous level.
// The line idles at LOW before the first bit, so the first 1 is a rising edge.
const HIGH = 0.5;
const LOW = 0.2;
const FLIP_THRESHOLD = 0.05;

function encodeText(text) {
    const bytes = Array.from(new TextEncoder().encode(String(text)));
    const binary = bytes.map((byte) => byte.toString(2).padStart(8, "0"));
    let level = LOW;
    const voltages = binary.map((bits) => [...bits].map((bit) => {
        if (bit === "1") {
            level = level === HIGH ? LOW : HIGH;
        }
        return level;
    }));
    return { bytes, binary, voltages };
}

function normalizeRows(value) {
    const shapeError = "Voltages must be a JSON array of samples, or one array of 8 samples per byte.";
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
        const rows = [];
        for (let index = 0; index < value.length; index += 8) {
            rows.push(value.slice(index, index + 8));
        }
        return rows;
    }
    throw new Error(shapeError);
}

function decodeVoltages(value) {
    const rows = normalizeRows(value);
    let previous = LOW;
    const bytes = [];

    for (const row of rows) {
        if (row.length === 0) {
            continue;
        }
        if (row.length !== 8) {
            throw new Error("Each byte needs exactly 8 voltage samples.");
        }
        let bits = "";
        for (const sample of row) {
            const level = Number(sample);
            if (sample === null || sample === "" || !Number.isFinite(level)) {
                throw new Error("Every voltage sample must be a number.");
            }
            bits += Math.abs(level - previous) > FLIP_THRESHOLD ? "1" : "0";
            previous = level;
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

globalThis.NRZI = { encodeText, decodeVoltages };

function drawWaveform(canvas, viewport, binaryGroups, voltageGroups) {
    const bits = binaryGroups.flatMap((group) => [...group]);
    const levels = voltageGroups.flat();
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    const viewportWidth = Math.max(viewport.clientWidth, 280);
    const cssHeight = 220;
    const padL = 52;
    const padR = 16;
    const padT = 20;
    const padB = 36;
    const lead = levels.length ? 20 : 0;

    let cssWidth = viewportWidth;
    let step = 0;
    if (levels.length) {
        const available = Math.max(viewportWidth - padL - padR - lead, 1);
        const minStep = 20;
        const maxStep = 64;
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

    const highY = padT + 18;
    const lowY = cssHeight - padB - 10;
    const plotBottom = cssHeight - padB;
    const plotRight = cssWidth - padR;

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
    ctx.moveTo(padL, highY);
    ctx.lineTo(plotRight, highY);
    ctx.moveTo(padL, lowY);
    ctx.lineTo(plotRight, lowY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#f0c14a";
    ctx.font = "11px ui-monospace, Consolas, monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("0.50", 8, highY);
    ctx.fillText("0.20", 8, lowY);

    canvas.setAttribute(
        "aria-label",
        levels.length
            ? "NRZI waveform with " + levels.length + " bit periods. A voltage change is a 1 and a hold is a 0."
            : "Empty NRZI waveform. Enter a message to draw it."
    );

    if (!levels.length) {
        ctx.fillStyle = "#a3b39a";
        ctx.font = "14px Segoe UI, system-ui, sans-serif";
        ctx.textBaseline = "middle";
        ctx.fillText("Enter a message to draw the waveform.", padL, (padT + plotBottom) / 2);
        return;
    }

    const origin = padL + lead;
    const yFor = (value) => (value > (HIGH + LOW) / 2 ? highY : lowY);

    ctx.save();
    ctx.strokeStyle = "rgba(240, 193, 74, 0.9)";
    ctx.setLineDash([2, 4]);
    for (let index = 8; index < levels.length; index += 8) {
        const x = Math.round(origin + index * step) + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, highY - 8);
        ctx.lineTo(x, lowY + 8);
        ctx.stroke();
    }
    ctx.restore();

    const trace = new Path2D();
    trace.moveTo(padL, lowY);
    trace.lineTo(origin, lowY);
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
        ctx.fillText(bit, origin + index * step + step / 2, cssHeight - 14);
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
    const messageInput = document.querySelector("#message");
    const bytesLabel = document.querySelector("#bytes-label");
    const bytesOut = document.querySelector("#bytes-out");
    const binaryOut = document.querySelector("#binary-out");
    const voltageOut = document.querySelector("#voltage-out");
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

    function paint() {
        const encoded = encodeText(messageInput.value);
        drawWaveform(canvas, viewport, encoded.binary, encoded.voltages);
        scrollHint.hidden = canvas.offsetWidth <= viewport.clientWidth + 1;
    }

    function renderEncode() {
        const encoded = encodeText(messageInput.value);
        voltages = encoded.voltages;
        const asciiOnly = encoded.bytes.every((byte) => byte < 128);
        bytesLabel.textContent = asciiOnly ? "ASCII" : "UTF-8 bytes";
        bytesOut.textContent = encoded.bytes.length ? encoded.bytes.join(" ") : "—";
        binaryOut.textContent = encoded.binary.length ? encoded.binary.join(" ") : "—";
        voltageOut.textContent = formatVoltages(voltages);
        const hasTrace = voltages.length > 0;
        sendButton.disabled = !hasTrace;
        copyButton.disabled = !hasTrace;
        paint();
    }

    function scheduleDraw() {
        cancelAnimationFrame(drawToken);
        drawToken = requestAnimationFrame(paint);
    }

    function renderDecode() {
        const raw = decodeInput.value.trim();
        if (!raw) {
            decodedText = "";
            decodeError.textContent = "";
            decodeOut.textContent = "Paste a voltage trace to recover the message.";
            decodeOut.classList.add("hint");
            copyDecoded.disabled = true;
            return;
        }

        try {
            decodedText = decodeVoltages(JSON.parse(raw));
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
