"use client";

import React, { useEffect, useState } from "react";
import { Plus, MessageCircleQuestion, CheckSquare, X, Send, Upload, Search, Star } from "lucide-react";
import type { DriveNodeDto, GroupDto } from "@/lib/types";
import { formatDateShort } from "@/lib/format";

interface QnaRow {
  id: string;
  code: string;
  subject: string;
  body: string;
  answer: string;
  status: string;
  priority: string;
  category: string;
  firstName: string;
  lastName: string;
  nodeName: string | null;
  nodeIndex: string | null;
  isFaq: boolean;
  createdAt: string;
}

export function QnaView({ isAdmin }: { isAdmin: boolean }) {
  const [questions, setQuestions] = useState<QnaRow[]>([]);
  const [filterMode, setFilterMode] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedQ, setSelectedQ] = useState<QnaRow | null>(null);
  const [answerDraft, setAnswerDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState("Answered");
  const [faqDraft, setFaqDraft] = useState(false);
  const [showAskModal, setShowAskModal] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("Finance");
  const [priority, setPriority] = useState("Medium");

  async function loadQna() {
    const res = await fetch("/api/qna");
    if (res.ok) {
      const d = await res.json();
      setQuestions(d.questions || []);
    }
  }

  useEffect(() => {
    loadQna();
  }, []);

  async function submitQuestion(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/qna", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, body, category, priority }),
    });
    if (res.ok) {
      setShowAskModal(false);
      setSubject("");
      setBody("");
      await loadQna();
    }
  }

  async function submitAnswer(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedQ) return;
    await fetch("/api/qna", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: selectedQ.id,
        answer: answerDraft,
        status: answerDraft.trim() ? statusDraft : statusDraft,
        isFaq: faqDraft,
      }),
    });
    setSelectedQ(null);
    await loadQna();
  }

  const visible = questions.filter((q) => {
    const qText = searchQuery.trim().toLowerCase();
    if (
      qText &&
      !`${q.code} ${q.subject} ${q.body} ${q.category}`.toLowerCase().includes(qText)
    ) {
      return false;
    }
    if (filterMode === "All") return true;
    if (filterMode === "FAQ") return q.isFaq;
    if (filterMode === "Unanswered") return q.status !== "Answered" && q.status !== "Closed";
    return q.status === filterMode;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Q&A</h2>
          <p className="text-xs text-[var(--apple-text-secondary)]">
            Structured investor questions and approved answers linked to mirrored Drive documents.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--apple-text-muted)]" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search questions..."
              className="w-48 rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-surface)] py-1.5 pr-3 pl-8 text-xs outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowAskModal(true)}
            className="flex items-center gap-1.5 rounded-xl bg-[#007AFF] px-3.5 py-2 text-xs font-semibold text-white"
          >
            <Plus className="h-3.5 w-3.5" /> Ask question
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
        <div className="apple-card space-y-1 p-3 text-xs">
          <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--apple-text-muted)]">
            Quick access
          </div>
          {["All", "Submitted", "Assigned", "Answered", "FAQ", "Unanswered"].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilterMode(f)}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left ${
                filterMode === f ? "bg-[var(--apple-selected)] font-semibold text-[#007AFF]" : "hover:bg-[var(--apple-hover)]"
              }`}
            >
              <span>{f}</span>
              <span className="tabular-nums text-[10px] opacity-70">
                {f === "All" ? questions.length : f === "FAQ" ? questions.filter((q) => q.isFaq).length : ""}
              </span>
            </button>
          ))}
        </div>

        <div className="apple-card overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--apple-border)] bg-[var(--apple-bg)]/50 text-[11px] font-semibold text-[var(--apple-text-secondary)]">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Author</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Category</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--apple-border)]">
              {visible.map((q) => (
                <tr
                  key={q.id}
                  onClick={() => {
                    setSelectedQ(q);
                    setAnswerDraft(q.answer || "");
                    setStatusDraft(q.answer ? q.status : "Answered");
                    setFaqDraft(Boolean(q.isFaq));
                  }}
                  className="cursor-pointer hover:bg-[var(--apple-hover)]"
                >
                  <td className="px-4 py-3 tabular-nums font-semibold">{q.code}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{q.subject}</div>
                    {q.nodeName && (
                      <div className="text-[10px] text-[#007AFF]">
                        {q.nodeIndex} {q.nodeName}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                        q.status === "Answered"
                          ? "bg-emerald-500/15 text-emerald-500"
                          : "bg-amber-500/15 text-amber-500"
                      }`}
                    >
                      {q.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {q.firstName} {q.lastName}
                  </td>
                  <td className="px-4 py-3">{q.priority}</td>
                  <td className="px-4 py-3">{q.category}</td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-[var(--apple-text-muted)]">
                    <MessageCircleQuestion className="mx-auto mb-2 h-8 w-8 opacity-50" />
                    No questions in this view.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Question Detail & Answer Drawer */}
      {selectedQ && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs" onClick={() => setSelectedQ(null)}>
          <form
            onSubmit={submitAnswer}
            className="apple-card flex h-full w-full max-w-lg flex-col justify-between rounded-none p-6 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-4 overflow-y-auto">
              <div className="flex items-center justify-between border-b border-[var(--apple-border)] pb-3">
                <span className="font-semibold text-[#007AFF]">{selectedQ.code} • {selectedQ.category}</span>
                <button type="button" onClick={() => setSelectedQ(null)}>
                  <X className="h-4 w-4" />
                </button>
              </div>
              <h3 className="text-base font-semibold">{selectedQ.subject}</h3>
              <p className="leading-relaxed text-[var(--apple-text-secondary)]">{selectedQ.body}</p>
              <div className="text-[11px] text-[var(--apple-text-muted)]">
                Asked by {selectedQ.firstName} {selectedQ.lastName} on {formatDateShort(selectedQ.createdAt)}
              </div>

              <div className="border-t border-[var(--apple-border)] pt-4">
                <label className="mb-1.5 block font-semibold">Official Response</label>
                {isAdmin ? (
                  <div className="space-y-3">
                    <textarea
                      rows={5}
                      value={answerDraft}
                      onChange={(e) => setAnswerDraft(e.target.value)}
                      placeholder="Write official answer..."
                      className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] p-3 outline-none"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <select
                        value={statusDraft}
                        onChange={(e) => setStatusDraft(e.target.value)}
                        className="rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] px-3 py-1.5"
                      >
                        <option value="Submitted">Submitted</option>
                        <option value="Assigned">Assigned</option>
                        <option value="Answered">Answered</option>
                        <option value="Closed">Closed</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setFaqDraft((v) => !v)}
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 font-medium ${
                          faqDraft
                            ? "border-amber-500/40 bg-amber-500/15 text-amber-500"
                            : "border-[var(--apple-border-strong)]"
                        }`}
                      >
                        <Star className="h-3.5 w-3.5" /> {faqDraft ? "Marked as FAQ" : "Mark as FAQ"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl bg-[var(--apple-bg)] p-3">
                    {selectedQ.answer || "Awaiting administrator response."}
                  </div>
                )}
              </div>
            </div>
            {isAdmin && (
              <div className="flex justify-end gap-2 border-t border-[var(--apple-border)] pt-4">
                <button type="submit" className="flex items-center gap-1.5 rounded-xl bg-[#007AFF] px-4 py-2 font-semibold text-white">
                  <Send className="h-3.5 w-3.5" /> Publish Answer
                </button>
              </div>
            )}
          </form>
        </div>
      )}

      {/* Ask Question Modal */}
      {showAskModal && (
        <form
          onSubmit={submitQuestion}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
        >
          <div className="apple-card w-full max-w-md space-y-4 p-6 text-xs">
            <h3 className="text-base font-semibold">Ask a Question</h3>
            <input
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] px-3 py-2"
            />
            <textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Question details..."
              className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] p-3"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] px-3 py-2"
              >
                {["Finance", "Tax", "Legal", "HR", "Accounting", "R&D"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] px-3 py-2"
              >
                {["Low", "Medium", "High", "Urgent"].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAskModal(false)} className="rounded-xl border border-[var(--apple-border)] px-4 py-2">
                Cancel
              </button>
              <button type="submit" className="rounded-xl bg-[#007AFF] px-4 py-2 font-semibold text-white">
                Submit
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

interface ChecklistRow {
  id: string;
  code: string;
  category: string;
  title: string;
  priority: string;
  status: string;
  linkedNodeId: string | null;
  nodeName: string | null;
  nodeIndex: string | null;
}

export function ChecklistView({ isAdmin }: { isAdmin: boolean; groups: GroupDto[] }) {
  const [items, setItems] = useState<ChecklistRow[]>([]);
  const [nodes, setNodes] = useState<DriveNodeDto[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Financial");
  const [linkedNodeId, setLinkedNodeId] = useState("");

  async function loadAll() {
    const [cRes, dRes] = await Promise.all([fetch("/api/checklist"), fetch("/api/documents")]);
    if (cRes.ok) {
      const d = await cRes.json();
      setItems(d.items || []);
    }
    if (dRes.ok) {
      const d = await dRes.json();
      setNodes(d.nodes || []);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/checklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, category, linkedNodeId: linkedNodeId || null }),
    });
    setShowAdd(false);
    setTitle("");
    await loadAll();
  }

  const readyPct = items.length ? Math.round((items.filter((i) => i.status === "Ready").length / items.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Due diligence checklist</h2>
          <p className="text-xs text-[var(--apple-text-secondary)]">
            Track deal readiness ({readyPct}% Ready) linked directly to mirrored Google Drive files.
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <label className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-surface)] px-3 py-2 text-xs font-medium hover:bg-[var(--apple-hover)]">
              <Upload className="h-3.5 w-3.5" /> Choose CSV
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const text = await file.text();
                  const lines = text.split(/\r?\n/).slice(1).filter(Boolean);
                  const bulkItems = lines.map((line) => {
                    const [cat, t, prio] = line.split(",");
                    return { category: cat?.trim() || "General", title: t?.trim() || "Item", priority: prio?.trim() || "Medium" };
                  });
                  await fetch("/api/checklist", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ bulkItems }),
                  });
                  await loadAll();
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 rounded-xl bg-[#007AFF] px-3.5 py-2 text-xs font-semibold text-white"
            >
              <Plus className="h-3.5 w-3.5" /> Add item
            </button>
          </div>
        )}
      </div>

      <div className="apple-card overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[var(--apple-border)] bg-[var(--apple-bg)]/50 text-[11px] font-semibold text-[var(--apple-text-secondary)]">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Requirement</th>
              <th className="px-4 py-3">Linked Google Drive File</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--apple-border)]">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3 tabular-nums font-semibold">{item.code}</td>
                <td className="px-4 py-3">{item.category}</td>
                <td className="px-4 py-3 font-medium">{item.title}</td>
                <td className="px-4 py-3 text-[#007AFF]">
                  {isAdmin ? (
                    <select
                      value={item.linkedNodeId || ""}
                      onChange={async (e) => {
                        await fetch("/api/checklist", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            id: item.id,
                            status: item.status,
                            linkedNodeId: e.target.value || null,
                          }),
                        });
                        await loadAll();
                      }}
                      className="max-w-[240px] rounded-lg border border-[var(--apple-border)] bg-[var(--apple-bg)] px-2 py-1 text-[11px] text-[var(--apple-text)]"
                    >
                      <option value="">Not linked</option>
                      {nodes.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.dotIndex} {n.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span>{item.nodeName ? `${item.nodeIndex} ${item.nodeName}` : "—"}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <select
                    disabled={!isAdmin}
                    value={item.status}
                    onChange={async (e) => {
                      await fetch("/api/checklist", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: item.id, status: e.target.value, linkedNodeId: item.linkedNodeId }),
                      });
                      await loadAll();
                    }}
                    className="rounded-lg border border-[var(--apple-border)] bg-[var(--apple-bg)] px-2 py-1 text-[11px]"
                  >
                    <option>Pending</option>
                    <option>In Progress</option>
                    <option>Ready</option>
                    <option>N/A</option>
                  </select>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-[var(--apple-text-muted)]">
                  <CheckSquare className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  No due diligence checklist items uploaded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <form
          onSubmit={handleAdd}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
        >
          <div className="apple-card w-full max-w-md space-y-4 p-6 text-xs">
            <h3 className="text-base font-semibold">Add Checklist Item</h3>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Requirement title"
              className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] px-3 py-2"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] px-3 py-2"
            >
              <option>Financial</option>
              <option>Legal</option>
              <option>Tax</option>
              <option>Corporate</option>
              <option>Operations</option>
            </select>
            <select
              value={linkedNodeId}
              onChange={(e) => setLinkedNodeId(e.target.value)}
              className="w-full rounded-xl border border-[var(--apple-border-strong)] bg-[var(--apple-bg)] px-3 py-2"
            >
              <option value="">Link to mirrored Drive document (optional)</option>
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.dotIndex} {n.name}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAdd(false)} className="rounded-xl border border-[var(--apple-border)] px-4 py-2">
                Cancel
              </button>
              <button type="submit" className="rounded-xl bg-[#007AFF] px-4 py-2 font-semibold text-white">
                Add
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
