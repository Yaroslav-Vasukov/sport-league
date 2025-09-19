function initMatchStats(root = document) {
  const rows = root.querySelectorAll(".match-stats__row");
  rows.forEach((row) => {
    const left = parseFloat(row.dataset.left || "0");
    const right = parseFloat(row.dataset.right || "0");
    const total = left + right;
    const leftP = total > 0 ? (left / total) * 100 : 50;
    const rightP = 100 - leftP;

    const leftVal = row.querySelector(".match-stats__value--left");
    const rightVal = row.querySelector(".match-stats__value--right");
    if (leftVal && leftVal.textContent.trim() === "") leftVal.textContent = left;
    if (rightVal && rightVal.textContent.trim() === "") rightVal.textContent = right;

    const lSeg = row.querySelector(".match-stats__segment--left");
    const rSeg = row.querySelector(".match-stats__segment--right");
    if (lSeg) lSeg.style.width = leftP + "%";
    if (rSeg) rSeg.style.width = rightP + "%";
  });
}