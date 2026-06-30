import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const INITIAL_BRANCHES = ["PEKAN", "JENGKA1", "JENGKA2"];

const DEFAULT_ITEM_LIST_TEXT = `No\tItem No.\tDescription
1\t8991389140055\tIK YELLOW A4 70GSM 450'S
2\t8991389140048\tIK YELLOW SIGNATURE A4 80GSM 500'S
3\t8991389140192\tIK YELLOW A4 80GSM 500'S
4\t8993280001114\tIK YELLOW A3 80GSM 500'S
5\t8993242597761\tPAPER ONE A4 70GSM 450'S
6\t8993242596993\tPAPER ONE A4 80GSM 500'S
7\t8856976000016\tKERTAS A4 DOUBLE A 80GSM 500'S
8\t8858741705621\tKERTAS A4 DOUBLE A 80GSM 550'S
9\t4549526607370\tCASIO FX-570MS2 CALCULATOR
10\t4971850092292\tCASIO FX-570EX CALCULATOR
11\t4549526613937\tCASIO FX-570EX-BLUE CALCULATOR
12\t4549526613920\tCASIO FX-570EX-PINK CALCULATOR
13\t9554100317106\tGAINTECH GT-570MS CALCULATOR
14\t9554100317182\tGAINTECH GT-570MS2 CALCULATOR
15\t9554100443935\tGAINTECH GT-570ES PLUS SOLAR
16\t9554100443973\tGAINTECH GT-570EX
17\t9554100517308\tGAINTECH GT-570EX BLACK
18\t9554100517315\tGAINTECH GT-570EX BLUE
19\t9554100517322\tGAINTECH GT-570EX PINK
20\t4902505900273\tPILOT-G3-10 GEL INK BLACK B/PEN
21\t4902505900280\tPILOT-G3-10 GEL INK BLUE B/PEN
22\t4902505163104\tPILOT-G2-5 GEL INK BLACK B/PEN
23\t4902505163128\tPILOT-G2-5 GEL INK BLUE NBC B/PEN
24\t842571133011\tHIKVISION M200R PENDRIVE 32GB 2.0
25\t740617309720\tKINGSTON PENDRIVE 32GB USB 3.2
26\t740617309829\tKINGSTON PENDRIVE 64GB USB 3.2
27\t886112447847\tHP CARTRIDGE- HP 678 COLOUR
28\t886112447830\tHP 678 BLACK INK CARTRIDGE
29\t889296532187\tHP 680 COLOUR INK CARTRIDGE
30\t889296532194\tHP 680 BLACK INK CARTRIDGE
31\t193905674275\tHP 682 COLOUR INK CARTRIDGE
32\t193905674282\tHP 682 BLACK INK CARTRIDGE
33\t4549292000061\tCANON CL-57 COLOUR INK CARTRIDGE
34\t4960999792354\tCANON CL-98 COLOUR INK CARTRIDGE
35\t4960999792347\tCANON PG-88 BLACK FOR E500 PRINTER
36\t4549292000016\tCANON PG-47 BLACK INK CARTRIDGE
37\t4549292041880\tCANON INK GI-790 BLACK
38\t4549292041903\tCANON INK GI-790 CYAN
39\t4549292041941\tCANON INK GI-790 YELLOW
40\t4549292041927\tCANON INK GI-790 MAGENTA
41\t4549292062304\tCANON INK CL-57S COLOUR INK
42\t8885007020235\tEPSON INK BLACK T6641
43\t8885007020266\tEPSON INK YELLOW T6644
44\t8885007020242\tEPSON INK CYAN T6642
45\t8885007020259\tEPSON INK MAGENTA T6613/6643
46\t8885007027876\tEPSON 003 BLACK 65ML
47\t8885007027937\tEPSON 003 YELLOW 65ML
48\t8885007027890\tEPSON 003 CYAN
49\t8885007027913\tEPSON 003 MAGENTA 65ML
50\t027084120134B\tHOT WHEELS BASIC CAR ASST 9F`;

const SESSION_KEY = "dailyCheckStockSession";

const state = {
  db: null,
  configured: false,
  initialized: false,
  settings: null,
  branches: [],
  items: [],
  session: null,
  activeTab: "reports",
  entryReport: null,
  reportBundle: null,
  loading: false,
  ui: {
    entryDate: todayISO(),
    reportDate: todayISO(),
    reportBranch: "all",
    showDeletedItems: false
  }
};

const appEl = document.getElementById("app");
const sessionBarEl = document.getElementById("sessionBar");
const toastEl = document.getElementById("toast");

document.addEventListener("DOMContentLoaded", init);
appEl.addEventListener("submit", handleSubmit);
appEl.addEventListener("click", handleClick);
appEl.addEventListener("change", handleChange);
sessionBarEl.addEventListener("click", handleClick);

async function init() {
  renderLoading();

  state.configured = isFirebaseConfigured();
  if (!state.configured) {
    render();
    return;
  }

  try {
    const firebaseApp = initializeApp(firebaseConfig);
    state.db = getFirestore(firebaseApp);
    await loadSettings();
    if (state.initialized) {
      await refreshBaseData();
      restoreSession();
      if (state.session) {
        state.activeTab = state.session.role === "branch" ? "entry" : "reports";
        await loadInitialTabData();
      }
    }
    render();
  } catch (error) {
    console.error(error);
    appEl.innerHTML = renderFatalError(error);
  }
}

function renderLoading() {
  sessionBarEl.innerHTML = "";
  appEl.innerHTML = `
    <section class="panel loading-panel">
      <div class="spinner" aria-hidden="true"></div>
      <p>Loading daily stock app...</p>
    </section>
  `;
}

function render() {
  renderSessionBar();

  if (!state.configured) {
    appEl.innerHTML = renderConfigMissing();
    return;
  }

  if (!state.initialized) {
    appEl.innerHTML = renderSetup();
    return;
  }

  if (!state.session) {
    appEl.innerHTML = renderLogin();
    return;
  }

  appEl.innerHTML = renderMain();
}

function renderSessionBar() {
  if (!state.session) {
    sessionBarEl.innerHTML = "";
    return;
  }

  const name = state.session.branchName || state.session.role.toUpperCase();
  sessionBarEl.innerHTML = `
    <div class="session-meta">
      <strong>${escapeHTML(name)}</strong><br>
      ${escapeHTML(labelRole(state.session.role))}
    </div>
    <button class="btn secondary small" type="button" data-action="logout">Logout</button>
  `;
}

function renderConfigMissing() {
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>Firebase config needed</h2>
          <p>The app files are ready. Add your Firebase Web App config before using Firestore.</p>
        </div>
      </div>
      <div class="panel-body grid">
        <div class="notice">
          Edit <strong>firebase-config.js</strong> and replace the placeholder values from Firebase Console.
        </div>
        <pre class="notice">Firebase Console &gt; Project settings &gt; General &gt; Your apps &gt; Web app</pre>
        <p class="muted">After saving the config, refresh this page. The first-run setup screen will create admin, branches, and items.</p>
      </div>
    </section>
  `;
}

function renderFatalError(error) {
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>Cannot start app</h2>
          <p>Check the Firebase config and Firestore availability.</p>
        </div>
      </div>
      <div class="panel-body">
        <div class="notice danger">${escapeHTML(error.message || String(error))}</div>
      </div>
    </section>
  `;
}

function renderSetup() {
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>First setup</h2>
          <p>Create the first admin password and seed branches/items into Firebase.</p>
        </div>
      </div>
      <div class="panel-body grid">
        <div class="notice">
          Initial branches: <strong>${INITIAL_BRANCHES.map(escapeHTML).join(", ")}</strong>. Guest view is enabled automatically and needs no password.
        </div>
        <form id="setup-form" class="form-grid">
          <div class="field span-6">
            <label for="setupAdminPassword">Admin password</label>
            <input id="setupAdminPassword" name="adminPassword" type="password" autocomplete="new-password" required>
          </div>
          <div class="field span-6">
            <label for="setupBranchPassword">Default branch password</label>
            <input id="setupBranchPassword" name="branchPassword" type="password" autocomplete="new-password" required>
          </div>
          <div class="field span-12">
            <button class="btn" type="submit">Create App Data</button>
          </div>
        </form>
      </div>
    </section>
  `;
}

function renderLogin() {
  const activeBranches = getActiveBranches();
  return `
    <section class="auth-grid">
      <div class="panel">
        <div class="panel-header">
          <div>
            <h2>Branch login</h2>
            <p>Select branch, enter password, then choose the report date for stock entry.</p>
          </div>
        </div>
        <div class="panel-body">
          <form id="branch-login-form" class="form-grid">
            <div class="field span-6">
              <label for="loginBranch">Branch</label>
              <select id="loginBranch" name="branchId" required>
                ${activeBranches.map((branch) => `<option value="${escapeAttr(branch.id)}">${escapeHTML(branch.name)}</option>`).join("")}
              </select>
            </div>
            <div class="field span-6">
              <label for="loginBranchPassword">Password</label>
              <input id="loginBranchPassword" name="password" type="password" autocomplete="current-password" required>
            </div>
            <div class="field span-12">
              <button class="btn" type="submit">Login Branch</button>
            </div>
          </form>
        </div>
      </div>

      <div class="grid">
        <div class="panel">
          <div class="panel-header">
            <div>
              <h2>Admin</h2>
              <p>Manage branches, passwords, item list, and report cleanup.</p>
            </div>
          </div>
          <div class="panel-body">
            <form id="admin-login-form" class="form-grid">
              <div class="field span-12">
                <label for="adminPassword">Admin password</label>
                <input id="adminPassword" name="password" type="password" autocomplete="current-password" required>
              </div>
              <div class="field span-12">
                <button class="btn secondary" type="submit">Login Admin</button>
              </div>
            </form>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">
            <div>
              <h2>Guest</h2>
              <p>Open report view without password.</p>
            </div>
          </div>
          <div class="panel-body">
            <button class="btn warning" type="button" data-action="guest-login">Open Guest Report</button>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderMain() {
  const tabs = getTabs();
  return `
    <nav class="tabs" aria-label="App sections">
      ${tabs
        .map(
          (tab) => `
            <button class="tab ${state.activeTab === tab.id ? "active" : ""}" type="button" data-action="tab" data-tab="${tab.id}">
              ${escapeHTML(tab.label)}
            </button>
          `
        )
        .join("")}
    </nav>
    ${renderActiveTab()}
  `;
}

function getTabs() {
  if (state.session.role === "branch") {
    return [
      { id: "entry", label: "Stock Entry" },
      { id: "reports", label: "Reports" }
    ];
  }

  if (state.session.role === "admin") {
    return [
      { id: "reports", label: "Reports" },
      { id: "admin", label: "Admin" }
    ];
  }

  return [{ id: "reports", label: "Reports" }];
}

function renderActiveTab() {
  if (state.activeTab === "entry" && state.session.role === "branch") {
    return renderEntry();
  }

  if (state.activeTab === "admin" && state.session.role === "admin") {
    return renderAdmin();
  }

  return renderReports();
}

function renderEntry() {
  const branch = getBranchById(state.session.branchId);
  const entryItems = getEntryItems();
  const reportExists = Boolean(state.entryReport);
  const lines = state.entryReport?.lines || {};

  return `
    <section class="panel">
      <div class="panel-header split-actions">
        <div>
          <h2>${escapeHTML(branch?.name || state.session.branchName)} Stock Entry</h2>
          <p>Selected date controls which daily report this submission belongs to.</p>
        </div>
        <span class="pill ${reportExists ? "good" : ""}">${reportExists ? "Editing existing report" : "New report"}</span>
      </div>
      <div class="panel-body grid">
        <form id="entry-date-form" class="form-grid">
          <div class="field span-3">
            <label for="entryDate">Report date</label>
            <input id="entryDate" name="entryDate" type="date" value="${escapeAttr(state.ui.entryDate)}" required>
          </div>
        </form>
        <form id="entry-form" class="grid">
          <div class="table-wrap">
            <table class="entry-table">
              <thead>
                <tr>
                  <th style="width: 64px;">No</th>
                  <th style="width: 150px;">Item No.</th>
                  <th>Description</th>
                  <th class="qty-cell">System Stock</th>
                  <th class="qty-cell">Physical Stock</th>
                </tr>
              </thead>
              <tbody>
                ${entryItems
                  .map((item, index) => {
                    const line = lines[item.id] || {};
                    return `
                      <tr data-entry-item-id="${escapeAttr(item.id)}">
                        <td>${index + 1}</td>
                        <td>${escapeHTML(item.itemNo)}</td>
                        <td>${escapeHTML(item.description)}</td>
                        <td><input data-qty="system" type="number" step="any" inputmode="decimal" value="${escapeAttr(formatQty(line.systemStock))}"></td>
                        <td><input data-qty="physical" type="number" step="any" inputmode="decimal" value="${escapeAttr(formatQty(line.physicalStock))}"></td>
                      </tr>
                    `;
                  })
                  .join("")}
              </tbody>
            </table>
          </div>
          <div class="button-row">
            <button class="btn" type="submit">${reportExists ? "Save Changes" : "Submit Report"}</button>
            <button class="btn secondary" type="button" data-action="reload-entry">Reload This Date</button>
          </div>
        </form>
      </div>
    </section>
  `;
}

function renderReports() {
  const activeBranches = getActiveBranches();
  const bundle = state.reportBundle;
  const reports = bundle?.reports || [];
  const reportsByBranch = new Map(reports.map((report) => [report.branchId, report]));
  const branchFilter = state.ui.reportBranch;
  const visibleBranches =
    branchFilter === "all"
      ? activeBranches
      : activeBranches.filter((branch) => branch.id === branchFilter);
  const reportRows = buildReportRows(visibleBranches, reportsByBranch);
  const submittedCount = activeBranches.filter((branch) => reportsByBranch.has(branch.id)).length;
  const missingCount = Math.max(activeBranches.length - submittedCount, 0);

  return `
    <section class="grid">
      <div class="stat-strip">
        <div class="stat"><strong>${activeBranches.length}</strong><span>Active branches</span></div>
        <div class="stat"><strong>${submittedCount}</strong><span>Submitted</span></div>
        <div class="stat"><strong>${missingCount}</strong><span>Missing</span></div>
        <div class="stat"><strong>${getActiveItems().length}</strong><span>Active items</span></div>
      </div>

      <section class="panel">
        <div class="panel-header split-actions">
          <div>
            <h2>Daily Report</h2>
            <p>Choose a date and branch filter to view submitted stock reports.</p>
          </div>
          <button class="btn secondary small" type="button" data-action="print-report">Print</button>
        </div>
        <div class="panel-body">
          <form id="report-filter-form" class="report-tools">
            <div class="field">
              <label for="reportDate">Report date</label>
              <input id="reportDate" name="reportDate" type="date" value="${escapeAttr(state.ui.reportDate)}" required>
            </div>
            <div class="field">
              <label for="reportBranch">Branch</label>
              <select id="reportBranch" name="reportBranch">
                <option value="all" ${branchFilter === "all" ? "selected" : ""}>All branches</option>
                ${activeBranches
                  .map(
                    (branch) =>
                      `<option value="${escapeAttr(branch.id)}" ${branchFilter === branch.id ? "selected" : ""}>${escapeHTML(branch.name)}</option>`
                  )
                  .join("")}
              </select>
            </div>
            <div class="button-row">
              <button class="btn secondary" type="button" data-action="reload-reports">Refresh Report</button>
            </div>
          </form>

          <div class="report-layout">
            <aside class="status-panel">
              ${renderStatusTable(activeBranches, reportsByBranch)}
            </aside>
            <div>
              ${reportRows.length ? renderReportTable(reportRows, visibleBranches, reportsByBranch, branchFilter !== "all") : renderEmpty("No items available for this report.")}
            </div>
          </div>
        </div>
      </section>
    </section>
  `;
}

function renderStatusTable(branches, reportsByBranch) {
  return `
    <div class="table-wrap">
      <table class="compact-table">
        <thead>
          <tr>
            <th>Branch</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${branches
            .map((branch) => {
              const hasReport = reportsByBranch.has(branch.id);
              return `
                <tr>
                  <td>${escapeHTML(branch.name)}</td>
                  <td class="${hasReport ? "status-ok" : "status-missing"}">${hasReport ? "Submitted" : "Missing"}</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderReportTable(rows, branches, reportsByBranch, showDifference = false) {
  if (!branches.length) {
    return renderEmpty("No branch selected.");
  }

  const branchColSpan = showDifference ? 3 : 2;

  return `
    <div class="report-table-wrap">
      <table class="report-table">
        <thead>
          <tr>
            <th class="sticky-col col-no" rowspan="2">No</th>
            <th class="sticky-col col-item" rowspan="2">Item No.</th>
            <th class="sticky-col col-desc" rowspan="2">Description</th>
            ${branches.map((branch) => `<th class="branch-head" colspan="${branchColSpan}">${escapeHTML(branch.name)}</th>`).join("")}
          </tr>
          <tr>
            ${branches
              .map(
                () =>
                  `<th class="stock-col">system</th><th class="stock-col">phy</th>${showDifference ? `<th class="stock-col">different</th>` : ""}`
              )
              .join("")}
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (item, index) => `
                <tr>
                  <td class="sticky-col col-no">${index + 1}</td>
                  <td class="sticky-col col-item">${escapeHTML(item.itemNo)}</td>
                  <td class="sticky-col col-desc">${escapeHTML(item.description)}</td>
                  ${branches
                    .map((branch) => {
                      const line = reportsByBranch.get(branch.id)?.lines?.[item.id] || null;
                      const difference = getStockDifference(line);
                      return `
                        <td class="stock-col">${escapeHTML(formatQty(line?.systemStock))}</td>
                        <td class="stock-col">${escapeHTML(formatQty(line?.physicalStock))}</td>
                        ${
                          showDifference
                            ? `<td class="stock-col ${differenceClass(difference)}">${escapeHTML(formatDifference(difference))}</td>`
                            : ""
                        }
                      `;
                    })
                    .join("")}
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderAdmin() {
  const activeBranches = getActiveBranches();
  const activeItems = getActiveItems();
  const visibleItems = state.ui.showDeletedItems
    ? state.items
    : state.items.filter((item) => !item.deleted);

  return `
    <section class="grid">
      <div class="stat-strip">
        <div class="stat"><strong>${activeBranches.length}</strong><span>Active branches</span></div>
        <div class="stat"><strong>${activeItems.length}</strong><span>Active items</span></div>
        <div class="stat"><strong>${state.items.filter((item) => item.deleted).length}</strong><span>Deleted items</span></div>
        <div class="stat"><strong>Guest</strong><span>No password</span></div>
      </div>
      ${renderBranchAdmin()}
      ${renderItemAdmin(visibleItems)}
      ${renderCleanupAdmin()}
    </section>
  `;
}

function renderBranchAdmin() {
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>Branches</h2>
          <p>Add branches, rename them, reset passwords, and enable or disable entry.</p>
        </div>
      </div>
      <div class="panel-body grid">
        <form id="branch-add-form" class="form-grid">
          <div class="field span-5">
            <label for="newBranchName">Branch name</label>
            <input id="newBranchName" name="branchName" placeholder="Example: MENTAKAB" required>
          </div>
          <div class="field span-5">
            <label for="newBranchPassword">Password</label>
            <input id="newBranchPassword" name="password" type="text" required>
          </div>
          <div class="field span-2">
            <button class="btn" type="submit">Add Branch</button>
          </div>
        </form>
        <div class="table-wrap">
          <table class="compact-table">
            <thead>
              <tr>
                <th style="width: 70px;">Order</th>
                <th>Branch</th>
                <th>Password</th>
                <th style="width: 110px;">Active</th>
                <th style="width: 120px;">Save</th>
              </tr>
            </thead>
            <tbody>
              ${state.branches
                .map(
                  (branch) => `
                    <tr data-branch-row="${escapeAttr(branch.id)}">
                      <td><input data-branch-field="order" type="number" step="1" value="${escapeAttr(branch.order ?? "")}"></td>
                      <td><input data-branch-field="name" value="${escapeAttr(branch.name)}"></td>
                      <td><input data-branch-field="password" value="${escapeAttr(branch.password || "")}"></td>
                      <td><input data-branch-field="active" type="checkbox" ${branch.active !== false ? "checked" : ""} aria-label="Active branch"></td>
                      <td><button class="btn secondary small" type="button" data-action="save-branch" data-branch-id="${escapeAttr(branch.id)}">Save</button></td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `;
}

function renderItemAdmin(items) {
  return `
    <section class="panel">
      <div class="panel-header split-actions">
        <div>
          <h2>Items</h2>
          <p>Soft delete hides an item from new stock entry, while old reports keep their snapshots.</p>
        </div>
        <label class="button-row label">
          <input id="showDeletedItems" type="checkbox" ${state.ui.showDeletedItems ? "checked" : ""} data-action="toggle-deleted-items">
          Show deleted
        </label>
      </div>
      <div class="panel-body grid">
        <form id="item-add-form" class="form-grid">
          <div class="field span-4">
            <label for="newItemNo">Item No.</label>
            <input id="newItemNo" name="itemNo" required>
          </div>
          <div class="field span-6">
            <label for="newItemDescription">Description</label>
            <input id="newItemDescription" name="description" required>
          </div>
          <div class="field span-2">
            <button class="btn" type="submit">Add Item</button>
          </div>
        </form>
        <div class="table-wrap">
          <table class="compact-table">
            <thead>
              <tr>
                <th style="width: 70px;">Order</th>
                <th style="width: 170px;">Item No.</th>
                <th>Description</th>
                <th style="width: 100px;">Active</th>
                <th style="width: 170px;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${items
                .map(
                  (item) => `
                    <tr data-item-row="${escapeAttr(item.id)}">
                      <td><input data-item-field="order" type="number" step="1" value="${escapeAttr(item.order ?? "")}" ${item.deleted ? "disabled" : ""}></td>
                      <td><input data-item-field="itemNo" value="${escapeAttr(item.itemNo)}" ${item.deleted ? "disabled" : ""}></td>
                      <td><input data-item-field="description" value="${escapeAttr(item.description)}" ${item.deleted ? "disabled" : ""}></td>
                      <td><input data-item-field="active" type="checkbox" ${item.active !== false && !item.deleted ? "checked" : ""} ${item.deleted ? "disabled" : ""} aria-label="Active item"></td>
                      <td class="button-row">
                        ${
                          item.deleted
                            ? `<span class="pill bad">Deleted</span>`
                            : `
                              <button class="btn secondary small" type="button" data-action="save-item" data-item-id="${escapeAttr(item.id)}">Save</button>
                              <button class="btn danger small" type="button" data-action="delete-item" data-item-id="${escapeAttr(item.id)}">Delete</button>
                            `
                        }
                      </td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `;
}

function renderCleanupAdmin() {
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>Report Cleanup</h2>
          <p>Delete all report documents for one selected year. Branches and item list are not deleted.</p>
        </div>
      </div>
      <div class="panel-body">
        <form id="cleanup-form" class="form-grid">
          <div class="field span-3">
            <label for="cleanupYear">Year</label>
            <input id="cleanupYear" name="year" type="number" min="2000" max="2100" step="1" placeholder="2026" required>
          </div>
          <div class="field span-9">
            <button class="btn danger" type="submit">Delete Reports For Year</button>
          </div>
        </form>
      </div>
    </section>
  `;
}

function renderEmpty(message) {
  return `<div class="empty-state">${escapeHTML(message)}</div>`;
}

async function handleSubmit(event) {
  event.preventDefault();
  const form = event.target;

  try {
    if (form.id === "setup-form") {
      await handleSetup(form);
    } else if (form.id === "branch-login-form") {
      await handleBranchLogin(form);
    } else if (form.id === "admin-login-form") {
      await handleAdminLogin(form);
    } else if (form.id === "entry-form") {
      await handleEntrySubmit(form);
    } else if (form.id === "branch-add-form") {
      await handleAddBranch(form);
    } else if (form.id === "item-add-form") {
      await handleAddItem(form);
    } else if (form.id === "cleanup-form") {
      await handleCleanup(form);
    }
  } catch (error) {
    console.error(error);
    showToast(error.message || String(error), "danger");
  }
}

async function handleClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target) return;

  const action = target.dataset.action;
  try {
    if (action === "logout") {
      logout();
    } else if (action === "guest-login") {
      await loginGuest();
    } else if (action === "tab") {
      await switchTab(target.dataset.tab);
    } else if (action === "reload-entry") {
      await loadEntryReport();
      render();
      showToast("Entry reloaded.", "success");
    } else if (action === "reload-reports") {
      await loadReportData();
      render();
      showToast("Report refreshed.", "success");
    } else if (action === "save-branch") {
      await handleSaveBranch(target.dataset.branchId);
    } else if (action === "save-item") {
      await handleSaveItem(target.dataset.itemId);
    } else if (action === "delete-item") {
      await handleDeleteItem(target.dataset.itemId);
    } else if (action === "print-report") {
      window.print();
    }
  } catch (error) {
    console.error(error);
    showToast(error.message || String(error), "danger");
  }
}

async function handleChange(event) {
  const target = event.target;

  try {
    if (target.id === "entryDate") {
      state.ui.entryDate = target.value || todayISO();
      await loadEntryReport();
      render();
    } else if (target.id === "reportDate") {
      state.ui.reportDate = target.value || todayISO();
      await loadReportData();
      render();
    } else if (target.id === "reportBranch") {
      state.ui.reportBranch = target.value || "all";
      render();
    } else if (target.dataset.action === "toggle-deleted-items") {
      state.ui.showDeletedItems = target.checked;
      render();
    }
  } catch (error) {
    console.error(error);
    showToast(error.message || String(error), "danger");
  }
}

async function handleSetup(form) {
  const formData = new FormData(form);
  const adminPassword = String(formData.get("adminPassword") || "").trim();
  const branchPassword = String(formData.get("branchPassword") || "").trim();

  if (!adminPassword || !branchPassword) {
    throw new Error("Admin password and default branch password are required.");
  }

  const seedItems = await loadSeedItems();
  if (!seedItems.length) {
    throw new Error("No seed items found.");
  }

  const batch = writeBatch(state.db);
  INITIAL_BRANCHES.forEach((name, index) => {
    const id = makeId(name);
    batch.set(doc(state.db, "branches", id), {
      name,
      password: branchPassword,
      active: true,
      order: index + 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  });

  seedItems.forEach((item) => {
    const id = makeItemId(item.order, item.itemNo);
    batch.set(doc(state.db, "items", id), {
      itemNo: item.itemNo,
      description: item.description,
      order: item.order,
      active: true,
      deleted: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  });

  batch.set(doc(state.db, "settings", "app"), {
    initialized: true,
    adminPassword,
    guestEnabled: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    initialBranchCount: INITIAL_BRANCHES.length,
    initialItemCount: seedItems.length
  });

  await batch.commit();
  await loadSettings();
  await refreshBaseData();
  state.session = { role: "admin" };
  saveSession();
  state.activeTab = "admin";
  render();
  showToast("App setup complete.", "success");
}

async function handleBranchLogin(form) {
  const formData = new FormData(form);
  const branchId = String(formData.get("branchId") || "");
  const password = String(formData.get("password") || "");
  const branch = getBranchById(branchId);

  if (!branch || branch.active === false) {
    throw new Error("Branch is not available.");
  }

  if (password !== String(branch.password || "")) {
    throw new Error("Wrong branch password.");
  }

  state.session = {
    role: "branch",
    branchId: branch.id,
    branchName: branch.name
  };
  saveSession();
  state.activeTab = "entry";
  await loadEntryReport();
  render();
}

async function handleAdminLogin(form) {
  const password = String(new FormData(form).get("password") || "");
  if (password !== String(state.settings?.adminPassword || "")) {
    throw new Error("Wrong admin password.");
  }

  state.session = { role: "admin" };
  saveSession();
  state.activeTab = "reports";
  await loadReportData();
  render();
}

async function loginGuest() {
  state.session = { role: "guest" };
  saveSession();
  state.activeTab = "reports";
  await loadReportData();
  render();
}

async function handleEntrySubmit(form) {
  requireRole("branch");

  const branch = getBranchById(state.session.branchId);
  if (!branch) {
    throw new Error("Branch no longer exists.");
  }

  const reportDate = state.ui.entryDate;
  const entryItems = getEntryItems();
  const lines = {};

  form.querySelectorAll("[data-entry-item-id]").forEach((row) => {
    const itemId = row.dataset.entryItemId;
    const item = entryItems.find((candidate) => candidate.id === itemId);
    if (!item) return;

    lines[itemId] = {
      itemId,
      itemNo: item.itemNo,
      description: item.description,
      order: item.order,
      systemStock: cleanQty(row.querySelector('[data-qty="system"]')?.value),
      physicalStock: cleanQty(row.querySelector('[data-qty="physical"]')?.value)
    };
  });

  await setDoc(
    doc(state.db, "reports", reportDocId(reportDate, branch.id)),
    {
      reportDate,
      branchId: branch.id,
      branchName: branch.name,
      lines,
      lineCount: Object.keys(lines).length,
      updatedAt: serverTimestamp(),
      createdAt: state.entryReport?.createdAt || serverTimestamp()
    },
    { merge: true }
  );

  await loadEntryReport();
  if (state.reportBundle?.date === reportDate) {
    await loadReportData();
  }
  render();
  showToast("Report saved.", "success");
}

async function handleAddBranch(form) {
  requireRole("admin");
  const formData = new FormData(form);
  const branchName = normalizeName(formData.get("branchName"));
  const password = String(formData.get("password") || "").trim();

  if (!branchName || !password) {
    throw new Error("Branch name and password are required.");
  }

  const branchId = makeId(branchName);
  const existing = await getDoc(doc(state.db, "branches", branchId));
  if (existing.exists()) {
    throw new Error("Branch already exists. Edit the existing branch instead.");
  }

  const nextOrder = maxOrder(state.branches) + 1;
  await setDoc(doc(state.db, "branches", branchId), {
    name: branchName,
    password,
    active: true,
    order: nextOrder,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  await refreshBaseData();
  form.reset();
  render();
  showToast("Branch added.", "success");
}

async function handleSaveBranch(branchId) {
  requireRole("admin");
  const row = appEl.querySelector(`[data-branch-row="${cssEscape(branchId)}"]`);
  if (!row) return;

  const name = normalizeName(row.querySelector('[data-branch-field="name"]')?.value);
  const password = String(row.querySelector('[data-branch-field="password"]')?.value || "").trim();
  const order = Number(row.querySelector('[data-branch-field="order"]')?.value || 0);
  const active = Boolean(row.querySelector('[data-branch-field="active"]')?.checked);

  if (!name || !password) {
    throw new Error("Branch name and password are required.");
  }

  await updateDoc(doc(state.db, "branches", branchId), {
    name,
    password,
    order: Number.isFinite(order) && order > 0 ? order : maxOrder(state.branches) + 1,
    active,
    updatedAt: serverTimestamp()
  });

  await refreshBaseData();
  render();
  showToast("Branch saved.", "success");
}

async function handleAddItem(form) {
  requireRole("admin");
  const formData = new FormData(form);
  const itemNo = String(formData.get("itemNo") || "").trim();
  const description = String(formData.get("description") || "").trim().toUpperCase();

  if (!itemNo || !description) {
    throw new Error("Item No. and description are required.");
  }

  const nextOrder = maxOrder(state.items) + 1;
  const itemId = makeItemId(Date.now(), itemNo);
  await setDoc(doc(state.db, "items", itemId), {
    itemNo,
    description,
    order: nextOrder,
    active: true,
    deleted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  await refreshBaseData();
  form.reset();
  render();
  showToast("Item added.", "success");
}

async function handleSaveItem(itemId) {
  requireRole("admin");
  const row = appEl.querySelector(`[data-item-row="${cssEscape(itemId)}"]`);
  if (!row) return;

  const itemNo = String(row.querySelector('[data-item-field="itemNo"]')?.value || "").trim();
  const description = String(row.querySelector('[data-item-field="description"]')?.value || "").trim().toUpperCase();
  const order = Number(row.querySelector('[data-item-field="order"]')?.value || 0);
  const active = Boolean(row.querySelector('[data-item-field="active"]')?.checked);

  if (!itemNo || !description) {
    throw new Error("Item No. and description are required.");
  }

  await updateDoc(doc(state.db, "items", itemId), {
    itemNo,
    description,
    order: Number.isFinite(order) && order > 0 ? order : maxOrder(state.items) + 1,
    active,
    updatedAt: serverTimestamp()
  });

  await refreshBaseData();
  render();
  showToast("Item saved.", "success");
}

async function handleDeleteItem(itemId) {
  requireRole("admin");
  const item = state.items.find((candidate) => candidate.id === itemId);
  if (!item) return;

  const confirmed = window.confirm(`Delete item from future stock entry?\n\n${item.itemNo} - ${item.description}\n\nOld reports will keep their saved snapshot.`);
  if (!confirmed) return;

  await updateDoc(doc(state.db, "items", itemId), {
    active: false,
    deleted: true,
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  await refreshBaseData();
  render();
  showToast("Item deleted from future reports.", "success");
}

async function handleCleanup(form) {
  requireRole("admin");
  const year = String(new FormData(form).get("year") || "").trim();
  if (!/^\d{4}$/.test(year)) {
    throw new Error("Enter a valid year, for example 2026.");
  }

  const confirmed = window.confirm(`Delete every report dated ${year}-01-01 to ${year}-12-31?\n\nThis cannot be undone.`);
  if (!confirmed) return;

  const reportQuery = query(
    collection(state.db, "reports"),
    where("reportDate", ">=", `${year}-01-01`),
    where("reportDate", "<=", `${year}-12-31`)
  );
  const snapshot = await getDocs(reportQuery);

  const docs = snapshot.docs;
  for (let index = 0; index < docs.length; index += 450) {
    const batch = writeBatch(state.db);
    docs.slice(index, index + 450).forEach((reportDoc) => batch.delete(reportDoc.ref));
    await batch.commit();
  }

  if (state.reportBundle?.date?.startsWith(`${year}-`)) {
    await loadReportData();
  }
  form.reset();
  render();
  showToast(`Deleted ${docs.length} report document(s) for ${year}.`, "success");
}

async function switchTab(tab) {
  if (!getTabs().some((candidate) => candidate.id === tab)) {
    return;
  }

  state.activeTab = tab;
  if (tab === "entry") {
    await loadEntryReport();
  } else if (tab === "reports") {
    await loadReportData();
  } else if (tab === "admin") {
    await refreshBaseData();
  }
  render();
}

async function loadInitialTabData() {
  if (state.activeTab === "entry") {
    await loadEntryReport();
  } else if (state.activeTab === "reports") {
    await loadReportData();
  }
}

async function loadSettings() {
  const settingsDoc = await getDoc(doc(state.db, "settings", "app"));
  state.settings = settingsDoc.exists() ? settingsDoc.data() : null;
  state.initialized = Boolean(state.settings?.initialized);
}

async function refreshBaseData() {
  const [branchSnapshot, itemSnapshot] = await Promise.all([
    getDocs(collection(state.db, "branches")),
    getDocs(collection(state.db, "items"))
  ]);

  state.branches = branchSnapshot.docs
    .map((branchDoc) => ({ id: branchDoc.id, ...branchDoc.data() }))
    .sort(sortByOrderThenName);

  state.items = itemSnapshot.docs
    .map((itemDoc) => ({ id: itemDoc.id, ...itemDoc.data() }))
    .sort(sortByOrderThenName);
}

async function loadEntryReport() {
  if (state.session?.role !== "branch") {
    state.entryReport = null;
    return;
  }

  const reportRef = doc(state.db, "reports", reportDocId(state.ui.entryDate, state.session.branchId));
  const reportSnap = await getDoc(reportRef);
  state.entryReport = reportSnap.exists() ? { id: reportSnap.id, ...reportSnap.data() } : null;
}

async function loadReportData() {
  const reportDate = state.ui.reportDate || todayISO();
  const reportQuery = query(collection(state.db, "reports"), where("reportDate", "==", reportDate));
  const snapshot = await getDocs(reportQuery);
  state.reportBundle = {
    date: reportDate,
    reports: snapshot.docs.map((reportDoc) => ({ id: reportDoc.id, ...reportDoc.data() }))
  };
}

async function loadSeedItems() {
  let itemText = DEFAULT_ITEM_LIST_TEXT;

  try {
    const response = await fetch("./item%20list.txt", { cache: "no-store" });
    if (response.ok) {
      itemText = await response.text();
    }
  } catch (error) {
    console.warn("Using embedded item seed because item list.txt could not be fetched.", error);
  }

  const parsed = parseItemList(itemText);
  return parsed.length ? parsed : parseItemList(DEFAULT_ITEM_LIST_TEXT);
}

function parseItemList(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\t+/))
    .filter((parts) => parts.length >= 3 && /^\d+$/.test(parts[0].trim()))
    .map((parts, index) => ({
      order: Number(parts[0]) || index + 1,
      itemNo: String(parts[1] || "").trim(),
      description: parts.slice(2).join(" ").trim().toUpperCase()
    }))
    .filter((item) => item.itemNo && item.description);
}

function buildReportRows(branches, reportsByBranch) {
  const rows = new Map();

  getActiveItems().forEach((item) => {
    rows.set(item.id, {
      id: item.id,
      itemNo: item.itemNo,
      description: item.description,
      order: item.order
    });
  });

  branches.forEach((branch) => {
    const report = reportsByBranch.get(branch.id);
    Object.entries(report?.lines || {}).forEach(([itemId, line]) => {
      if (!rows.has(itemId)) {
        rows.set(itemId, {
          id: itemId,
          itemNo: line.itemNo || "",
          description: line.description || "",
          order: line.order || 999999
        });
      }
    });
  });

  return Array.from(rows.values()).sort(sortByOrderThenName);
}

function getActiveBranches() {
  return state.branches.filter((branch) => branch.active !== false);
}

function getActiveItems() {
  return state.items.filter((item) => item.active !== false && !item.deleted);
}

function getEntryItems() {
  const rows = new Map();

  getActiveItems().forEach((item) => {
    rows.set(item.id, {
      id: item.id,
      itemNo: item.itemNo,
      description: item.description,
      order: item.order
    });
  });

  Object.entries(state.entryReport?.lines || {}).forEach(([itemId, line]) => {
    if (!rows.has(itemId)) {
      rows.set(itemId, {
        id: itemId,
        itemNo: line.itemNo || "",
        description: line.description || "",
        order: line.order || 999999
      });
    }
  });

  return Array.from(rows.values()).sort(sortByOrderThenName);
}

function getBranchById(branchId) {
  return state.branches.find((branch) => branch.id === branchId);
}

function requireRole(role) {
  if (state.session?.role !== role) {
    throw new Error("You do not have permission for this action.");
  }
}

function saveSession() {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(state.session));
}

function restoreSession() {
  try {
    const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    if (!session?.role) return;

    if (session.role === "branch") {
      const branch = getBranchById(session.branchId);
      if (!branch || branch.active === false) return;
      state.session = {
        role: "branch",
        branchId: branch.id,
        branchName: branch.name
      };
    } else if (session.role === "admin" || session.role === "guest") {
      state.session = session;
    }
  } catch (error) {
    console.warn("Session restore failed.", error);
  }
}

function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  state.session = null;
  state.activeTab = "reports";
  state.entryReport = null;
  state.reportBundle = null;
  render();
}

function reportDocId(date, branchId) {
  return `${date}_${branchId}`;
}

function makeId(value) {
  const cleaned = normalizeName(value)
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || `ID_${Date.now()}`;
}

function makeItemId(order, itemNo) {
  const orderPart = String(order).padStart(3, "0");
  const itemPart = String(itemNo || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `ITEM_${orderPart}_${itemPart || Date.now()}`;
}

function normalizeName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toUpperCase();
}

function maxOrder(records) {
  return records.reduce((max, record) => {
    const order = Number(record.order || 0);
    return Number.isFinite(order) && order > max ? order : max;
  }, 0);
}

function sortByOrderThenName(a, b) {
  const orderA = Number(a.order || 999999);
  const orderB = Number(b.order || 999999);
  if (orderA !== orderB) return orderA - orderB;
  const nameA = a.name || a.description || a.itemNo || "";
  const nameB = b.name || b.description || b.itemNo || "";
  return String(nameA).localeCompare(String(nameB));
}

function cleanQty(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";

  const number = Number(text);
  return Number.isFinite(number) ? number : "";
}

function formatQty(value) {
  if (value === null || value === undefined || value === "") return "";
  return String(value);
}

function getStockDifference(line) {
  if (!line || line.systemStock === "" || line.physicalStock === "") {
    return "";
  }

  const systemStock = Number(line.systemStock);
  const physicalStock = Number(line.physicalStock);
  if (!Number.isFinite(systemStock) || !Number.isFinite(physicalStock)) {
    return "";
  }

  return systemStock - physicalStock;
}

function formatDifference(value) {
  if (value === "") return "";
  return value === 0 ? "0 normal" : `${value} abnormal`;
}

function differenceClass(value) {
  if (value === "") return "";
  return value === 0 ? "diff-ok" : "diff-bad";
}

function todayISO() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function labelRole(role) {
  if (role === "admin") return "Admin";
  if (role === "branch") return "Branch user";
  return "Guest view";
}

function showToast(message, type = "info") {
  toastEl.textContent = message;
  toastEl.className = `toast show ${type}`;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toastEl.className = "toast";
  }, 2800);
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHTML(value);
}

function cssEscape(value) {
  if (window.CSS?.escape) {
    return window.CSS.escape(value);
  }
  return String(value).replace(/["\\]/g, "\\$&");
}
