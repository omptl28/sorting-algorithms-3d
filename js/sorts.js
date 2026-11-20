// sorts.js — the step recorder.
//
// Each sort runs instantly on a COPY of the array and records every move as a
// list of steps. The animator then plays that list one step at a time, so the
// animation always matches the real algorithm.
//
// Step types:
//   { type: "compare", i, j, line }   two bars are being compared
//   { type: "swap",    i, j, line }   two bars exchange places
//   { type: "sorted",  i, line }      bar at index i is in its final place
//   { type: "pivot",   i, line }      quick sort: bar at index i is the pivot
//   { type: "range",   lo, hi, line } quick sort: now working on a[lo..hi]
//   { type: "done" }                  everything is sorted
//
// "line" is the pseudocode line (0-based) to highlight while the step plays.

"use strict";

const Sorts = (function () {

    // Bubble sort: compare neighbours and swap them if out of order. Each pass moves the
    // largest remaining value to the end. Stops early if a pass makes no swaps.
    function bubble(input) {
        const a = input.slice();
        const steps = [];
        const n = a.length;
        for (let i = 0; i < n - 1; i++) {
            let swapped = false;
            for (let j = 0; j < n - 1 - i; j++) {
                steps.push({ type: "compare", i: j, j: j + 1, line: 2 });
                if (a[j] > a[j + 1]) {
                    [a[j], a[j + 1]] = [a[j + 1], a[j]];
                    steps.push({ type: "swap", i: j, j: j + 1, line: 3 });
                    swapped = true;
                }
            }
            steps.push({ type: "sorted", i: n - 1 - i, line: 4 });
            if (!swapped) {
                // early exit: no swaps means the rest is already in order
                for (let k = n - 2 - i; k >= 0; k--) steps.push({ type: "sorted", i: k, line: 5 });
                break;
            }
        }
        if (n > 0 && steps.filter(s => s.type === "sorted").length < n) {
            steps.push({ type: "sorted", i: 0, line: 4 });
        }
        steps.push({ type: "done" });
        return { steps, result: a };
    }

    // Insertion sort: take each value and swap it left until the one before it is smaller,
    // like sorting cards in your hand.
    function insertion(input) {
        const a = input.slice();
        const steps = [];
        const n = a.length;
        for (let i = 1; i < n; i++) {
            let j = i;
            while (j > 0) {
                steps.push({ type: "compare", i: j - 1, j: j, line: 2 });
                if (a[j - 1] > a[j]) {
                    [a[j - 1], a[j]] = [a[j], a[j - 1]];
                    steps.push({ type: "swap", i: j - 1, j: j, line: 3 });
                    j--;
                } else {
                    break;
                }
            }
        }
        // in insertion sort no bar is "final" until the very end
        for (let k = 0; k < n; k++) steps.push({ type: "sorted", i: k, line: 5 });
        steps.push({ type: "done" });
        return { steps, result: a };
    }

    // Selection sort: find the smallest remaining value and swap it to the front, then repeat.
    function selection(input) {
        const a = input.slice();
        const steps = [];
        const n = a.length;
        for (let i = 0; i < n - 1; i++) {
            let min = i;
            for (let j = i + 1; j < n; j++) {
                steps.push({ type: "compare", i: min, j: j, line: 3 });
                if (a[j] < a[min]) min = j;
            }
            if (min !== i) {
                [a[i], a[min]] = [a[min], a[i]];
                steps.push({ type: "swap", i: i, j: min, line: 5 });
            }
            steps.push({ type: "sorted", i: i, line: 6 });
        }
        if (n > 0) steps.push({ type: "sorted", i: n - 1, line: 6 });
        steps.push({ type: "done" });
        return { steps, result: a };
    }

    // Lomuto partition, last element as pivot.
    function quick(input) {
        const a = input.slice();
        const steps = [];

        // Sort a[lo..hi]: put the pivot (a[hi]) in its final place, smaller values left of it,
        // larger values right of it, then sort each side the same way.
        function qs(lo, hi) {
            if (lo > hi) return;
            steps.push({ type: "range", lo, hi, line: 0 });
            if (lo === hi) {
                steps.push({ type: "sorted", i: lo, line: 1 });
                return;
            }
            steps.push({ type: "pivot", i: hi, line: 2 });
            const pivot = a[hi];
            let i = lo;
            for (let j = lo; j < hi; j++) {
                steps.push({ type: "compare", i: j, j: hi, line: 5 });
                if (a[j] < pivot) {
                    if (i !== j) {
                        [a[i], a[j]] = [a[j], a[i]];
                        steps.push({ type: "swap", i: i, j: j, line: 6 });
                    }
                    i++;
                }
            }
            if (i !== hi) {
                [a[i], a[hi]] = [a[hi], a[i]];
                steps.push({ type: "swap", i: i, j: hi, line: 7 });
            }
            steps.push({ type: "sorted", i: i, line: 7 });
            qs(lo, i - 1);     // line 8
            qs(i + 1, hi);     // line 9
        }

        qs(0, a.length - 1);
        steps.push({ type: "done" });
        return { steps, result: a };
    }

    // Pseudocode shown in the side panel; "line" in each step indexes into these.
    const pseudocode = {
        bubble: [
            "for i = 0 to n-2",
            "  for j = 0 to n-2-i",
            "    if a[j] > a[j+1]",
            "      swap(a[j], a[j+1])",
            "  mark a[n-1-i] sorted",
            "  if no swaps: mark rest, stop"
        ],
        insertion: [
            "for i = 1 to n-1",
            "  j = i",
            "  while j > 0 and a[j-1] > a[j]",
            "    swap(a[j-1], a[j])",
            "    j = j - 1",
            "mark all sorted"
        ],
        selection: [
            "for i = 0 to n-2",
            "  min = i",
            "  for j = i+1 to n-1",
            "    if a[j] < a[min]",
            "      min = j",
            "  swap(a[i], a[min])",
            "  mark a[i] sorted"
        ],
        quick: [
            "quickSort(lo, hi):",
            "  if lo == hi: mark sorted, return",
            "  pivot = a[hi]",
            "  i = lo",
            "  for j = lo to hi-1",
            "    if a[j] < pivot",
            "      swap(a[i], a[j]); i++",
            "  swap(a[i], a[hi]); mark a[i]",
            "  quickSort(lo, i-1)",
            "  quickSort(i+1, hi)"
        ]
    };

    const names = {
        bubble: "Bubble sort",
        insertion: "Insertion sort",
        selection: "Selection sort",
        quick: "Quick sort"
    };

    // Run the chosen sort on a copy of the values and return its list of steps.
    function record(algorithm, values) {
        switch (algorithm) {
            case "bubble":    return bubble(values);
            case "insertion": return insertion(values);
            case "selection": return selection(values);
            case "quick":     return quick(values);
            default: throw new Error("Unknown algorithm: " + algorithm);
        }
    }

    return { record, pseudocode, names };
})();
