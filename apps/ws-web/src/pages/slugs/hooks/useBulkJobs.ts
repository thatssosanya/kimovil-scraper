import { createSignal, onCleanup, createMemo } from "solid-js";
import type {
  BulkJobInfo,
  BulkJobStats,
  BulkLastCompleted,
  ScrapeStatus,
} from "../types";

interface UseBulkJobsOptions {
  onScrapeStatusUpdate: (
    slug: string,
    status: Partial<ScrapeStatus>,
  ) => void;
  onJobComplete: () => void;
}

export function useBulkJobs(options: UseBulkJobsOptions) {
  const [wsConnected, setWsConnected] = createSignal(false);
  const [bulkJob, setBulkJob] = createSignal<BulkJobInfo | null>(null);
  const [bulkJobStats, setBulkJobStats] = createSignal<BulkJobStats | null>(
    null,
  );
  const [allJobs, setAllJobs] = createSignal<
    Array<{ job: BulkJobInfo; stats: BulkJobStats }>
  >([]);
  const [selectedJobId, setSelectedJobId] = createSignal<string | null>(null);
  const [lastCompleted, setLastCompleted] =
    createSignal<BulkLastCompleted | null>(null);
  const [bulkLoading, setBulkLoading] = createSignal(false);
  const [bulkJobLoading, setBulkJobLoading] = createSignal(false);
  const [now, setNow] = createSignal(Date.now());

  let ws: WebSocket | null = null;
  let activeRequestId: string | null = null;
  let timerId: ReturnType<typeof setInterval>;

  const selectedJob = createMemo(() => {
    const id = selectedJobId();
    if (!id) return null;
    return allJobs().find((j) => j.job.id === id) ?? null;
  });

  const formatTimeRemaining = (targetTimestamp: number | null) => {
    if (!targetTimestamp) return "";
    const diff = Math.max(0, Math.ceil(targetTimestamp - now() / 1000));
    if (diff === 0) return "Ready";
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const fetchAllJobs = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          id: "req-list",
          method: "bulk.list",
          params: {},
        }),
      );
    }
  };

  const subscribeToBulkJob = (jobId: string) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      const reqId = crypto.randomUUID();
      activeRequestId = reqId;
      ws.send(
        JSON.stringify({
          id: reqId,
          method: "bulk.subscribe",
          params: { jobId },
        }),
      );
    }
  };

  const connectWs = () => {
    ws = new WebSocket("ws://localhost:1488/ws");

    ws.onopen = () => {
      console.log("WS Connected");
      setWsConnected(true);
      fetchAllJobs();

      const persisted = localStorage.getItem("bulk-job");
      if (persisted) {
        try {
          const { jobId } = JSON.parse(persisted);
          if (jobId) {
            subscribeToBulkJob(jobId);
          }
        } catch (e) {
          console.error("Failed to parse persisted job", e);
          localStorage.removeItem("bulk-job");
        }
      }
    };

    ws.onclose = () => {
      console.log("WS Disconnected");
      setWsConnected(false);
      setTimeout(connectWs, 3000);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.id) {
          if (data.id === "req-list" && data.result?.jobs) {
            setAllJobs(data.result.jobs);
            if (bulkJob()) {
              const currentInList = data.result.jobs.find(
                (j: { job: BulkJobInfo }) => j.job.id === bulkJob()!.id,
              );
              if (currentInList) {
                setBulkJob((prev) => ({ ...prev!, ...currentInList.job }));
                setBulkJobStats(currentInList.stats);
              }
            }
          } else if (
            (data.result?.success || data.result?.job) &&
            ["req-pause", "req-resume", "req-workers"].includes(data.id)
          ) {
            if (data.result.job) {
              setAllJobs((prev) =>
                prev.map((item) =>
                  item.job.id === data.result.job.id
                    ? { ...item, job: data.result.job }
                    : item,
                ),
              );
              if (bulkJob()?.id === data.result.job.id) {
                setBulkJob((prev) => ({ ...prev!, ...data.result.job }));
              }
            }
          }
        }

        if (activeRequestId && data.id === activeRequestId) {
          if (data.result) {
            const { job, stats } = data.result;
            if (job) {
              setBulkJob(job);
              setBulkJobStats(stats);
              localStorage.setItem(
                "bulk-job",
                JSON.stringify({ jobId: job.id, requestId: activeRequestId }),
              );
              setAllJobs((prev) => {
                const idx = prev.findIndex((j) => j.job.id === job.id);
                if (idx >= 0) {
                  const next = [...prev];
                  next[idx] = { job, stats };
                  return next;
                }
                return [{ job, stats }, ...prev];
              });
            }
          } else if (data.error) {
            alert(`Error: ${data.error.message}`);
            setBulkJobLoading(false);
            setBulkLoading(false);
          }
        }

        if (data.event) {
          const evt = data.event;

          if (evt.type === "bulk.jobUpdate") {
            setAllJobs((prev) =>
              prev.map((item) =>
                item.job.id === evt.job.id
                  ? {
                      ...item,
                      job: { ...item.job, ...evt.job },
                      stats: evt.stats || item.stats,
                    }
                  : item,
              ),
            );

            if (bulkJob() && bulkJob()!.id === evt.job.id) {
              setBulkJob((prev) => ({ ...prev!, ...evt.job }));
              if (evt.stats) setBulkJobStats(evt.stats);
            }
          } else if (evt.type === "bulk.progress") {
            if (evt.jobId) {
              setAllJobs((prev) =>
                prev.map((item) =>
                  item.job.id === evt.jobId
                    ? { ...item, stats: evt.stats }
                    : item,
                ),
              );
            }

            if (bulkJob() && bulkJob()!.id === evt.jobId) {
              setBulkJobStats(evt.stats);
              if (evt.lastCompleted) {
                setLastCompleted(evt.lastCompleted);
                if (evt.lastCompleted.success) {
                  options.onScrapeStatusUpdate(evt.lastCompleted.slug, {
                    hasHtml: true,
                    isCorrupted: false,
                    queueStatus: "done",
                  });
                }
              }
            }
          } else if (evt.type === "bulk.done") {
            setAllJobs((prev) =>
              prev.map((item) =>
                item.job.id === evt.jobId
                  ? {
                      ...item,
                      job: { ...item.job, status: evt.status },
                      stats: evt.stats,
                    }
                  : item,
              ),
            );

            if (bulkJob() && bulkJob()!.id === evt.jobId) {
              setBulkJobStats(evt.stats);
              setBulkJob((prev) =>
                prev ? { ...prev, status: evt.status } : null,
              );
              localStorage.removeItem("bulk-job");
              options.onJobComplete();
            }
          }
        }
      } catch (e) {
        console.error("WS Message Error", e);
      }
    };
  };

  const pauseJob = (jobId: string) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(
      JSON.stringify({
        id: "req-pause",
        method: "bulk.pause",
        params: { jobId },
      }),
    );
  };

  const resumeJob = (jobId: string) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(
      JSON.stringify({
        id: "req-resume",
        method: "bulk.resume",
        params: { jobId },
      }),
    );
  };

  const setJobWorkers = (jobId: string, workerCount: number) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(
      JSON.stringify({
        id: "req-workers",
        method: "bulk.setWorkers",
        params: { jobId, workerCount },
      }),
    );
  };

  const startBulkJob = async (filterType: "all" | "unscraped") => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      alert("WebSocket not connected");
      return;
    }
    setBulkJobLoading(true);
    setLastCompleted(null);

    const reqId = crypto.randomUUID();
    activeRequestId = reqId;

    ws.send(
      JSON.stringify({
        id: reqId,
        method: "bulk.start",
        params: { mode: "fast", filter: filterType },
      }),
    );

    setTimeout(() => setBulkJobLoading(false), 2000);
  };

  const queueBulk = async (slugsToQueue: string[]) => {
    if (slugsToQueue.length === 0) {
      alert("All selected items already have scraped data");
      return;
    }

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      alert("WebSocket not connected");
      return;
    }

    setBulkLoading(true);
    setLastCompleted(null);

    const reqId = crypto.randomUUID();
    activeRequestId = reqId;

    ws.send(
      JSON.stringify({
        id: reqId,
        method: "bulk.start",
        params: { mode: "fast", slugs: slugsToQueue },
      }),
    );

    setTimeout(() => setBulkLoading(false), 2000);
  };

  const clearBulkJobUI = () => {
    setBulkJob(null);
    setBulkJobStats(null);
    setLastCompleted(null);
    localStorage.removeItem("bulk-job");
  };

  const selectJob = (jobId: string) => {
    setSelectedJobId(jobId);
    subscribeToBulkJob(jobId);
  };

  const deselectJob = () => {
    setSelectedJobId(null);
  };

  const init = () => {
    connectWs();
    timerId = setInterval(() => setNow(Date.now()), 1000);
  };

  const cleanup = () => {
    clearInterval(timerId);
    if (ws) ws.close();
  };

  onCleanup(cleanup);

  return {
    wsConnected,
    bulkJob,
    bulkJobStats,
    allJobs,
    selectedJobId,
    selectedJob,
    lastCompleted,
    bulkLoading,
    bulkJobLoading,
    now,
    formatTimeRemaining,
    init,
    startBulkJob,
    pauseJob,
    resumeJob,
    setJobWorkers,
    queueBulk,
    clearBulkJobUI,
    selectJob,
    deselectJob,
  };
}
