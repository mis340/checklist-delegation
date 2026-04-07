import React, { useState, useEffect, useCallback, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import axios from "axios";
import AdminLayout from "../components/layout/AdminLayout";

// --- Frequency Color Map ---
const freqColors = {
  daily: "#a21caf",
  weekly: "#38bdf8",
  monthly: "#f59e42",
  oneTime: "#10b981",
  leave: "#ef4444", // Red for leave
};

const freqLabels = {
  daily: "Daily Tasks",
  weekly: "Weekly Tasks",
  monthly: "Monthly Tasks",
  oneTime: "One-Time Tasks",
  leave: "Leave Tasks", // Label for leave
};

// --- Calendar Event Colors ---
const EVENT_COLORS = {
  leave: "#ef4444",   // Red
  holiday: "#f59e0b", // Yellow
  task: "#10b981",    // Green
};

const HOLIDAY_LIST_2026 = {
  "26/01/2026": "Republic Day",
  "04/03/2026": "Holi",
  "15/08/2026": "Independence Day",
  "20/10/2026": "Dussehra",
  "08/11/2026": "Diwali",
  "09/11/2026": "Govardhan Puja",
  "07/02/2026": "Family exigencies",
};

// Sheet Type Colors - D for Delegation (Blue), C for Checklist (Green)
const sheetColors = {
  DELEGATION: "#3b82f6", // Blue
  Checklist: "#10b981", // Green
};

// --- Date helpers ---
const toYMD = (d) => {
  if (!d) return "";
  const date = toDate(d);
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatIfDate = (val) => {
  if (!val || typeof val !== "string") return val;
  // Check if it looks like an ISO date or long date string
  if (val.match(/^\d{4}-\d{2}-\d{2}T/) || (val.includes(":") && !isNaN(Date.parse(val)))) {
    const d = toDate(val);
    if (d) return formatDate(d);
  }
  return val;
};

const toDate = (d) => {
  if (!d) return null;
  if (d instanceof Date) return d;
  if (typeof d === "number") return new Date(d);
  if (typeof d === "string") {
    // Try DD/MM/YYYY regex first to prevent Date.parse from guessing wrong
    let m = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
      // Create local date using constructor
      return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
    }

    let t = Date.parse(d);
    if (!isNaN(t)) return new Date(t);
  }
  return null;
};

const formatDate = (d) => {
  d = toDate(d);
  if (!d) return "";
  return `${String(d.getDate()).padStart(2, "0")}/${String(
    d.getMonth() + 1
  ).padStart(2, "0")}/${d.getFullYear()}`;
};

const isSameDay = (d1, d2) => {
  d1 = toDate(d1);
  d2 = toDate(d2);
  if (!d1 || !d2) return false;
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

const freqMapKey = (freq) => {
  if (!freq) return "oneTime";
  freq = freq.toLowerCase();
  if (freq.startsWith("d")) return "daily";
  if (freq.startsWith("w")) return "weekly";
  if (freq.startsWith("m")) return "monthly";
  return "oneTime";
};

const normalize = (val) => (val == null ? "" : String(val)).trim().toLowerCase();

// Helper to get dates from today to last working date
const getDatesFromTodayToLastWorkingDate = (workingDates) => {
  if (!workingDates || workingDates.length === 0) return [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find the last working date
  const sortedDates = [...workingDates].sort((a, b) => a - b);
  const lastWorkingDate = sortedDates[sortedDates.length - 1];

  if (!lastWorkingDate) return [];

  return workingDates.filter((date) => {
    return date > today && date <= lastWorkingDate;
  });
};

// Helper to get last working date from working dates array
const getLastWorkingDate = (workingDates) => {
  if (!workingDates || workingDates.length === 0) return null;

  const sortedDates = [...workingDates].sort((a, b) => a - b);
  return sortedDates[sortedDates.length - 1];
};

// Helper to calculate next occurrence dates based on frequency within range
const getNextOccurrences = (
  task,
  workingDates,
  currentDate,
  lastWorkingDate
) => {
  const { startDate, freq } = task;
  const freqType = freqMapKey(freq);
  const today = new Date(currentDate);
  today.setHours(0, 0, 0, 0);

  const occurrences = [];
  const taskStartDate = toDate(startDate);

  if (!taskStartDate || !lastWorkingDate) return occurrences;

  // If task is in the past, find next occurrence
  let nextDate = new Date(taskStartDate);

  // For one-time tasks, just check if it's within range
  if (freqType === "oneTime") {
    // if (nextDate >= today && nextDate <= lastWorkingDate) {
    //   occurrences.push(nextDate);
    // }

    if (nextDate > today && nextDate <= lastWorkingDate) {
      occurrences.push(nextDate);
    }
    return occurrences;
  }

  // For recurring tasks, calculate occurrences within range
  let iterationCount = 0;
  const maxIterations = 1000; // Safety limit for long ranges

  while (nextDate <= lastWorkingDate && iterationCount < maxIterations) {
    if (nextDate > today) {
      occurrences.push(new Date(nextDate));
    }

    // Calculate next date based on frequency
    if (freqType === "daily") {
      nextDate.setDate(nextDate.getDate() + 1);
    } else if (freqType === "weekly") {
      nextDate.setDate(nextDate.getDate() + 7);
    } else if (freqType === "monthly") {
      nextDate.setMonth(nextDate.getMonth() + 1);
    } else {
      break;
    }

    iterationCount++;
  }

  // Filter to only include dates that are in working dates
  return occurrences.filter((date) =>
    workingDates.some((workingDate) => isSameDay(workingDate, date))
  );
};

const CalendarUI = ({ userRole, userName, displayName }) => {
  // Get user details and dynamic URL/Sheet from sessionStorage
  const role = userRole || sessionStorage.getItem("role") || "user";
  const uName = userName || sessionStorage.getItem("username") || "";
  const dName = displayName || sessionStorage.getItem("displayName") || "";

  // Dynamic URL from sessionStorage
  const BACKEND_URL =
    "https://script.google.com/macros/s/AKfycbyaBCq6ZKHhOZBXRp9qw3hqrXh_aIOPvIHh_G41KtzPovhjl-UjEgj75Ok6gwJhrPOX/exec";

  // ---- STATE ----
  const [events, setEvents] = useState([]);
  const [dateDataMap, setDateDataMap] = useState({});
  const [allWorkingDates, setAllWorkingDates] = useState([]);
  const [lastWorkingDate, setLastWorkingDate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalTab, setModalTab] = useState("day");
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    completed: 0,
  });
  const calendarRef = useRef(null);
  const [calendarKey, setCalendarKey] = useState(0);

  // NEW: Name filter state
  const [selectedNameFilter, setSelectedNameFilter] = useState("all");
  const [availableNames, setAvailableNames] = useState([]);

  // --- Role filter ---
  const roleFilteredTasks = useCallback(
    (tasks) => {
      if (!tasks || tasks.length === 0) return [];
      if (role === "admin" || role === "main admin") return tasks;
      return tasks.filter(
        (t) =>
          normalize(t.name) === normalize(uName) ||
          normalize(t.name) === normalize(dName)
      );
    },
    [role, uName, dName]
  );

  // --- Pending filter ---
  const filterPendingTasks = useCallback((tasks) => {
    if (!tasks || tasks.length === 0) return [];
    return tasks.filter((t) =>
      normalize(t.status || "") !== "done"
    );
  }, []);

  // NEW: Name filter function
  const applyNameFilter = useCallback((tasks, filterName) => {
    if (!tasks || tasks.length === 0) return [];
    if (filterName === "all") return tasks;
    return tasks.filter((t) => normalize(t.name) === normalize(filterName));
  }, []);

  // --- Stats ---
  const calculateStats = (tasks) => {
    const total = tasks.length;
    const completed = tasks.filter(
      (t) => normalize(t.status || "") === "done"
    ).length;
    const pending = total - completed;

    setStats({
      total,
      pending,
      completed,
    });
  };

  // --- Data transform for Checklist sheet tasks ---
  const transformChecklistToTasks = (rows) => {
    if (!rows || rows.length === 0) return [];
    let leaves = [];
    for (let i = 1; i < rows.length; i++) {
        const c = rows[i].c || [];
        if (!c[1]?.v && !c[4]?.v) continue; // Skip if no taskId or name

        leaves.push({
            taskId: String(c[1]?.v || ""),
            name: String(c[4]?.v || ""),
            description: String(c[5]?.v || ""), // Column F
            date: c[6]?.v || "",
            status: String(c[12]?.v || ""),
            remarks: String(c[13]?.v || "")
        });
    }
    return leaves;
  };

  // --- Data transform for Unique sheet ---
  const transformToTasks = (rows) => {
    if (!rows || rows.length === 0) return [];
    let tasks = [];

    // Assuming Unique sheet has columns:
    // 0: Timestamp, 1: Task ID, 2: Department, 3: Given By, 4: Name,
    // 5: Description, 6: Start Date, 7: Frequency, 8: Time,
    // 9: Status, 10: Remarks, 11: Priority, etc.

    for (let i = 1; i < rows.length; i++) {
      const c = rows[i].c;
      if (!c || c.length === 0) continue;
      if (!c.some((cell) => cell && cell.v)) continue;

      const nameColumnIndex = 4; // Adjust based on your Unique sheet structure

      const taskId = c[1]?.v || "",
        startDateStr = c[6]?.v || "",
        startDate = toDate(startDateStr),
        timeStr = c[8]?.v || "",
        status = c[9]?.v || "pending",
        remarks = c[10]?.v || "",
        priority = c[11]?.v || "normal";

      if (!startDate || !taskId) continue;

      tasks.push({
        taskId,
        department: c[2]?.v || "",
        givenBy: c[3]?.v || "",
        name: c[nameColumnIndex]?.v || "",
        description: c[5]?.v || "",
        startDate,
        freq: c[7]?.v?.toString().trim() || "",
        time: timeStr,
        status: status,
        remarks: remarks,
        priority: priority,
        timestamp: c[0]?.v || "",
        rowIndex: i + 2,
        sheetType: "UNIQUE",
      });
    }
    return tasks;
  };

  // --- Main build: Create combined events from today to last working date ---
  const generateCombinedDateMap = (uniqueTasks, workingDates, checklistTasks = []) => {
    let map = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Create lookups for Checklist entries
    const dayExecutionLookup = {}; // Key: dateStr | taskId
    const dayNameDescLookup = {};  // Key: dateStr | name | description

    checklistTasks.forEach(item => {
        const d = toDate(item.date);
        if (d) {
            const dateStr = toYMD(d);
            if (item.taskId) {
                dayExecutionLookup[`${dateStr}|${item.taskId}`] = item;
            }
            // Always store in name-desc lookup as fallback
            const nameDescKey = `${dateStr}|${normalize(item.name)}|${normalize(item.description)}`;
            dayNameDescLookup[nameDescKey] = item;
        }
    });

    // Helper to find daily checklist entry for a task
    const findExecutionData = (dateStr, task) => {
        // Priority 1: Task ID match
        let match = dayExecutionLookup[`${dateStr}|${task.taskId}`];
        // Priority 2: Name + Description match
        if (!match) {
            const nameDescKey = `${dateStr}|${normalize(task.name)}|${normalize(task.description)}`;
            match = dayNameDescLookup[nameDescKey];
        }
        return match;
    };

    // Determine if a specific date/task is a leave
    const isLeaveCheck = (dateStr, task) => {
        const lookupItem = findExecutionData(dateStr, task);
        if (lookupItem) {
            const status = normalize(lookupItem.status);
            const remarks = normalize(lookupItem.remarks);
            const desc = normalize(lookupItem.description);
            if (status === "leave" || remarks.includes("leave") || desc.includes("leave")) return true;
        }
        // Fallback to master remarks/desc
        if (normalize(task.remarks).includes("leave") || normalize(task.description).includes("leave")) return true;
        return false;
    };

    // Get the last working date
    const lastDate = getLastWorkingDate(workingDates);
    setLastWorkingDate(lastDate);

    // Filter working dates from today to last working date
    const filteredWorkingDates =
      getDatesFromTodayToLastWorkingDate(workingDates);

    // Process Unique tasks
    const filteredTasks = roleFilteredTasks(uniqueTasks);
    const pendingTasks = filterPendingTasks(filteredTasks);
    const nameFilteredTasks = applyNameFilter(pendingTasks, selectedNameFilter);

    for (const task of nameFilteredTasks) {
      if (!task.startDate) continue;

      // Get all occurrences within range
      const occurrences = getNextOccurrences(
        task,
        filteredWorkingDates,
        today,
        lastDate
      );

      for (const occurrenceDate of occurrences) {
        const dateStr = toYMD(occurrenceDate);

        if (!map[dateStr]) {
          map[dateStr] = {
            tasks: [],
            tasksByTime: {},
          };
        }

        // Check if this task is a leave for this specific date
        const isLeave = isLeaveCheck(dateStr, task);
        const taskType = isLeave ? "leave" : "task";

        // Enrich recurring task with specific data from the Checklist for this date
        const executionData = findExecutionData(dateStr, task);
        
        const taskWithTime = {
          ...task,
          status: executionData?.status || task.status,
          remarks: executionData?.remarks || task.remarks,
          displayDate: dateStr,
          occurrenceDate: occurrenceDate,
          calendarType: taskType,
        };
        map[dateStr].tasks.push(taskWithTime);

        const timeKey = task.time || "no-time";
        const groupKey = `${timeKey}|${taskType}`;
        if (!map[dateStr].tasksByTime[groupKey]) {
          map[dateStr].tasksByTime[groupKey] = [];
        }
        map[dateStr].tasksByTime[groupKey].push(taskWithTime);
      }
    }
    
    // 2. Process Standalone leaves from Checklist (that might not be in Unique tasks)
    checklistTasks.forEach(item => {
        const status = normalize(item.status);
        const remarks = normalize(item.remarks);
        const desc = normalize(item.description);
        
        if (status === "leave" || remarks.includes("leave") || desc.includes("leave")) {
            const d = toDate(item.date);
            if (!d) return;
            const dateStr = toYMD(d);
            
            if (!map[dateStr]) {
                map[dateStr] = { tasks: [], tasksByTime: {} };
            }

            // Deduplication: Check if we already have this specific entry (either as a processed recurring task or a previous checklist row)
            const alreadyExists = map[dateStr].tasks.some(t => 
                (item.taskId && t.taskId === item.taskId) || (normalize(t.name) === normalize(item.name) && normalize(t.description) === normalize(item.description))
            );
            
            if (!alreadyExists) {
                const leaveTask = {
                    taskId: item.taskId || `L-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
                    name: item.name,
                    description: item.description || "General Leave",
                    startDate: d,
                    occurrenceDate: d,
                    calendarType: "leave",
                    status: item.status,
                    remarks: item.remarks,
                    displayDate: dateStr,
                    time: "no-time"
                };

                // Respect the Name Filter
                if (selectedNameFilter === "all" || normalize(leaveTask.name) === normalize(selectedNameFilter)) {
                    map[dateStr].tasks.push(leaveTask);
                    const groupKey = "no-time|leave";
                    if (!map[dateStr].tasksByTime[groupKey]) {
                        map[dateStr].tasksByTime[groupKey] = [];
                    }
                    map[dateStr].tasksByTime[groupKey].push(leaveTask);
                }
            }
        }
    });

    // Process Holidays
    Object.keys(HOLIDAY_LIST_2026).forEach((hDateStr) => {
      const hDate = toDate(hDateStr);
      if (!hDate) return;
      const dateStr = toYMD(hDate);
      if (!map[dateStr]) {
        map[dateStr] = { tasks: [], tasksByTime: {} };
      }
      map[dateStr].isHoliday = true;
      map[dateStr].holidayReason = HOLIDAY_LIST_2026[hDateStr];
    });

    return map;
  };

  // NEW: Extract unique names from tasks
  const extractUniqueNames = (tasks) => {
    const names = new Set();

    tasks.forEach((task) => {
      if (task.name && task.name.trim()) {
        names.add(task.name.trim());
      }
    });

    return Array.from(names).sort();
  };

  // --- API FETCH ---
  const fetchData = useCallback(async () => {
    let isMounted = true;
    try {
      setLoading(true);
      setError(null);

      // Step 1: Fetch Working Day Calendar
      const wdcResponse = await axios.get(
        `${BACKEND_URL}?sheet=Working Day Calendar&action=fetch`,
        { timeout: 30000 }
      );
      if (!isMounted) return;
      let allDates = [];
      if (
        wdcResponse.data &&
        wdcResponse.data.table &&
        wdcResponse.data.table.rows
      ) {
        const rows = wdcResponse.data.table.rows;
        for (let i = 1; i < rows.length; i++) {
          const cells = rows[i].c || [];
          const dateValue = cells[0]?.v || "";
          const parsedDate = toDate(dateValue);
          if (parsedDate) allDates.push(parsedDate);
        }
      }
      setAllWorkingDates(allDates);

      // Step 2: Fetch UNIQUE sheet tasks
      const uniqueResponse = await axios.get(
        `${BACKEND_URL}?sheet=Unique&action=fetch`,
        { timeout: 30000 }
      );
      if (!isMounted) return;
      let uniqueTasks = [];
      if (
        uniqueResponse.data &&
        uniqueResponse.data.table &&
        uniqueResponse.data.table.rows
      ) {
        uniqueTasks = transformToTasks(uniqueResponse.data.table.rows);
      }

      // Step 3: Fetch Checklist sheet tasks (to detect leaves)
      const checklistResponse = await axios.get(
        `${BACKEND_URL}?sheet=Checklist&action=fetch`,
        { timeout: 30000 }
      );
      if (!isMounted) return;
      let checklistTasks = [];
      if (
        checklistResponse.data &&
        checklistResponse.data.table &&
        checklistResponse.data.table.rows
      ) {
        checklistTasks = transformChecklistToTasks(checklistResponse.data.table.rows);
      }

      // NEW: Extract unique names for dropdown
      const names = extractUniqueNames(uniqueTasks);
      setAvailableNames(names);

      // Step 4: Calculate stats
      calculateStats(uniqueTasks);

      // Step 5: Build combined per-date map from today to last working date
      const map = generateCombinedDateMap(uniqueTasks, allDates, checklistTasks);
      setDateDataMap(map);

      // Create events with proper time slots
      const eventsArray = [];
      Object.keys(map).forEach((dateStr) => {
        const dayData = map[dateStr];
        const tasksByTime = dayData.tasksByTime || {};

        Object.keys(tasksByTime).forEach((groupKey) => {
          const tasksAtTime = tasksByTime[groupKey];
          const taskCount = tasksAtTime.length || 0;

          if (taskCount === 0) return;

          const [timeKey, taskType] = groupKey.split("|");

          // Parse time
          let eventStart = dateStr;
          let eventEnd = dateStr;
          let isAllDay = true;

          if (timeKey !== "no-time") {
            const timeStr = timeKey.trim();
            let hour = 0,
              minute = 0;

            // 24-hour format
            const time24Match = timeStr.match(/^(\d{1,2}):(\d{2})/);
            if (time24Match) {
              hour = parseInt(time24Match[1]);
              minute = parseInt(time24Match[2]);
              isAllDay = false;
            } else {
              // 12-hour format
              const time12Match = timeStr.match(
                /^(\d{1,2}):(\d{2})\s*(AM|PM)/i
              );
              if (time12Match) {
                hour = parseInt(time12Match[1]);
                minute = parseInt(time12Match[2]);
                const isPM = time12Match[3].toUpperCase() === "PM";
                if (isPM && hour !== 12) hour += 12;
                if (!isPM && hour === 12) hour = 0;
                isAllDay = false;
              }
            }

            if (!isAllDay) {
              eventStart = `${dateStr}T${String(hour).padStart(
                2,
                "0"
              )}:${String(minute).padStart(2, "0")}:00`;
              // Set end time as 1 hour later
              const endHour = (hour + 1) % 24;
              eventEnd = `${dateStr}T${String(endHour).padStart(
                2,
                "0"
              )}:${String(minute).padStart(2, "0")}:00`;
            }
          }

          eventsArray.push({
            id: `${dateStr}-${groupKey}`,
            start: eventStart,
            end: isAllDay ? undefined : eventEnd,
            allDay: isAllDay,
            title: taskType === "leave" ? `${taskCount} Leave` : `${taskCount} Tasks`,
            extendedProps: {
              dateStr: dateStr,
              timeKey: timeKey,
              taskCount: taskCount,
              tasks: tasksAtTime,
              taskType: taskType,
            },
            backgroundColor: EVENT_COLORS[taskType] || EVENT_COLORS.task,
          });
        });

        // Add Holiday event
        if (dayData.isHoliday) {
          eventsArray.push({
            id: `${dateStr}-holiday`,
            start: dateStr,
            allDay: true,
            title: dayData.holidayReason || "Holiday",
            extendedProps: {
              dateStr: dateStr,
              taskType: "holiday",
              taskCount: 0,
              tasks: [],
              holidayReason: dayData.holidayReason || "Holiday",
            },
            backgroundColor: EVENT_COLORS.holiday,
          });
        }
      });

      setEvents(eventsArray);
      setCalendarKey((prev) => prev + 1);
      setError(null);
    } catch (err) {
      console.error("Fetch error:", err);
      setError("Failed to load data: " + (err.message || "Unknown error"));
      setEvents([]);
      setDateDataMap({});
      setStats({
        total: 0,
        pending: 0,
        completed: 0,
      });
      setCalendarKey((prev) => prev + 1);
    } finally {
      setLoading(false);
    }
    return () => {
      isMounted = false;
    };
  }, [
    role,
    uName,
    dName,
    BACKEND_URL,
    roleFilteredTasks,
    filterPendingTasks,
    selectedNameFilter,
    applyNameFilter,
  ]);

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      if (!cancelled) await fetchData();
    };
    loadData();

    // Refresh data every 5 minutes
    const intervalId = setInterval(() => {
      if (!cancelled) fetchData();
    }, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [fetchData]);

  // --- EVENT/MODAL HANDLERS ---
  const handleEventClick = useCallback(
    (info) => {
      const props = info.event.extendedProps;
      const dateStr = props.dateStr || info.event.startStr.split("T")[0];
      const timeKey = props.timeKey || "no-time";

      setSelectedEvent({
        isDateView: true,
        date: formatDate(dateStr),
        dateObj: toDate(dateStr),
        timeKey: timeKey,
        dataObj: dateDataMap[dateStr] || {
          tasks: [],
        },
        tasksAtTime: props.tasks || [],
      });
      setModalTab("day");
      setShowModal(true);
    },
    [dateDataMap]
  );

  const handleDateClick = useCallback(
    (info) => {
      const dateStr = info.dateStr;
      const dateObj = toDate(info.dateStr);
      setSelectedEvent({
        isDateView: true,
        date: formatDate(info.dateStr),
        dateObj: dateObj,
        timeKey: "all",
        dataObj: dateDataMap[dateStr] || {
          tasks: [],
        },
        tasksAtTime: [],
      });
      setModalTab("day");
      setShowModal(true);
    },
    [dateDataMap]
  );

  // Format date for display
  const formatDateDisplay = (date) => {
    if (!date) return "";
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // --- UI ---
  if (loading)
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 px-4">
          <div className="relative">
            <div className="w-16 h-16 sm:w-20 sm:h-20 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
          <p className="mt-6 text-lg sm:text-xl font-semibold text-gray-700 animate-pulse text-center">
            Loading calendar data...
          </p>
        </div>
      </AdminLayout>
    );

  if (error)
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-red-50 via-pink-50 to-rose-50 p-4">
          <div className="bg-white p-6 sm:p-10 rounded-3xl shadow-2xl max-w-md w-full border-2 border-red-100">
            <div className="flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 mx-auto bg-gradient-to-br from-red-500 to-pink-500 rounded-full shadow-lg">
              <svg
                className="w-8 h-8 sm:w-10 sm:h-10 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h3 className="mt-6 text-xl sm:text-2xl font-bold text-center text-gray-900">
              {error}
            </h3>
            <button
              onClick={fetchData}
              className="mt-6 w-full px-6 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl hover:from-red-600 hover:to-pink-600 transition-all duration-200 shadow-md hover:shadow-lg font-semibold"
            >
              Retry
            </button>
          </div>
        </div>
      </AdminLayout>
    );

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-100 py-4 sm:py-8 px-2 sm:px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header Card */}
          <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 mb-3 border border-gray-100">
            <div className="flex flex-col gap-2 sm:gap-3">
              {/* Header Section with Buttons on Right - Single Row */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
                    <svg
                      className="w-4 h-4 sm:w-5 sm:h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>

                  <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    Task Calendar
                  </h1>
                </div>

                {/* Actions on Right Side */}
                <div className="flex gap-2 items-center">
                  {/* Name Filter Dropdown */}
                  <select
                    value={selectedNameFilter}
                    onChange={(e) => setSelectedNameFilter(e.target.value)}
                    className="px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-all"
                  >
                    <option value="all">All Names</option>
                    {availableNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>

                  {/* Refresh Button */}
                  <button
                    onClick={fetchData}
                    disabled={loading}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg
                      className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${loading ? 'animate-spin' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    <span className="hidden sm:inline">Refresh</span>
                  </button>
                </div>
              </div>

              {/* Date Range Info - Compact */}
              {lastWorkingDate && (
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-100 rounded-lg px-2.5 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <svg
                      className="w-3.5 h-3.5 text-blue-600 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <span className="text-xs font-medium text-gray-700">
                      Today → {formatDateDisplay(lastWorkingDate)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Calendar */}
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl p-2 sm:p-8 border border-indigo-100">
            <style>{`
              .fc-event {
                background-color: transparent !important;
                border: none !important;
              }
              .fc-daygrid-event {
                background-color: transparent !important;
                border: none !important;
              }
              .fc-h-event {
                background-color: transparent !important;
                border: none !important;
              }
              .fc-timegrid-event {
                background-color: transparent !important;
                border: none !important;
              }
              .fc .fc-toolbar {
                flex-direction: column;
                gap: 0.5rem;
              }
              @media (min-width: 640px) {
                .fc .fc-toolbar {
                  flex-direction: row;
                }
              }
              .fc .fc-toolbar-chunk {
                display: flex;
                flex-wrap: wrap;
                justify-content: center;
                gap: 0.25rem;
              }
              .fc .fc-button {
                padding: 0.375rem 0.75rem !important;
                font-size: 0.875rem !important;
              }
              @media (min-width: 640px) {
                .fc .fc-button {
                  padding: 0.5rem 1rem !important;
                  font-size: 1rem !important;
                }
              }
              .fc-theme-standard td, .fc-theme-standard th {
                border-color: #e5e7eb;
              }
            `}</style>
            <FullCalendar
              key={calendarKey}
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "dayGridMonth,timeGridWeek,timeGridDay",
              }}
              slotMinTime="00:00:00"
              slotMaxTime="24:00:00"
              slotDuration="01:00:00"
              slotLabelInterval="01:00"
              slotLabelFormat={{
                hour: "numeric",
                minute: "2-digit",
                hour12: false,
              }}
              events={events}
              editable={false}
              selectable={true}
              selectMirror={true}
              dayMaxEvents={true}
              weekends={true}
              dateClick={handleDateClick}
              eventClick={handleEventClick}
              height="auto"
              eventDisplay="block"
              displayEventTime={true}
              eventTimeFormat={{
                hour: "numeric",
                minute: "2-digit",
                hour12: false,
              }}
              eventBackgroundColor="transparent"
              eventBorderColor="transparent"
              eventClassNames="cursor-pointer transition-all duration-200 hover:opacity-80"
              dayCellClassNames="hover:bg-green-100"
              allDaySlot={true}
              nowIndicator={true}
              // Set valid range from today to last working date
              validRange={
                lastWorkingDate
                  ? {
                    start: new Date(
                      new Date().setDate(new Date().getDate() + 1)
                    ),
                    end: lastWorkingDate,
                  }
                  : {}
              }
              eventContent={(arg) => {
                const props = arg.event.extendedProps;
                const taskCount = props?.taskCount || 0;
                const taskType = props?.taskType || "task";

                const bgColor = EVENT_COLORS[taskType] || EVENT_COLORS.task;
                const title = taskType === "holiday" ? (props?.holidayReason || "Holiday") :
                  taskType === "leave" ? `${taskCount} Leave` :
                    `${taskCount} Tasks`;

                return (
                  <div className="flex items-center justify-center gap-1 p-0.5 sm:p-1 h-full w-full">
                    <div
                      className="text-[10px] sm:text-xs font-bold text-white py-0.5 sm:py-1 rounded-full shadow-sm w-[75%] sm:w-[65%] mx-auto text-center truncate"
                      style={{ backgroundColor: bgColor }}
                    >
                      {title}
                    </div>
                  </div>
                );
              }}
            />

            {/* Color Legend */}
            <div className="mt-6 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full shadow-sm" style={{ backgroundColor: EVENT_COLORS.task }}></div>
                <span className="text-sm font-semibold text-gray-700">All Task</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full shadow-sm" style={{ backgroundColor: EVENT_COLORS.leave }}></div>
                <span className="text-sm font-semibold text-gray-700">Leave Task</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full shadow-sm" style={{ backgroundColor: EVENT_COLORS.holiday }}></div>
                <span className="text-sm font-semibold text-gray-700">Holidays</span>
              </div>
            </div>
          </div>
        </div>
        {showModal && selectedEvent && (
          <TaskModal
            event={selectedEvent}
            onClose={() => setShowModal(false)}
            tab={modalTab}
            // setTab={setTab}
            setTab={setModalTab}
            dateDataMap={dateDataMap}
            allWorkingDates={allWorkingDates}
            lastWorkingDate={lastWorkingDate}
          />
        )}
      </div>
    </AdminLayout>
  );
};

const TaskModal = ({
  event,
  onClose,
  tab,
  setTab,
  dateDataMap,
  allWorkingDates,
  lastWorkingDate,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("name");
  const [statusFilter, setStatusFilter] = useState("all");

  if (!event.isDateView) return null;

  // Get tasks based on selected tab
  const getTasksForTab = () => {
    if (tab === "day") {
      return event.dataObj.tasks || [];
    } else if (tab === "week") {
      const dateObj = event.dateObj;
      const weekTasks = [];

      const dayOfWeek = dateObj.getDay();
      const startOfWeek = new Date(dateObj);
      startOfWeek.setDate(dateObj.getDate() - dayOfWeek);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      Object.keys(dateDataMap).forEach((dateStr) => {
        const d = new Date(dateStr);
        if (d >= startOfWeek && d <= endOfWeek) {
          const dayTasks = dateDataMap[dateStr]?.tasks || [];
          dayTasks.forEach((task) => {
            if (!weekTasks.some((t) => t.taskId === task.taskId)) {
              weekTasks.push(task);
            }
          });
        }
      });

      return weekTasks;
    } else if (tab === "month") {
      const dateObj = event.dateObj;
      const monthTasks = [];

      const month = dateObj.getMonth();
      const year = dateObj.getFullYear();

      Object.keys(dateDataMap).forEach((dateStr) => {
        const d = new Date(dateStr);
        if (d.getMonth() === month && d.getFullYear() === year) {
          const dayTasks = dateDataMap[dateStr]?.tasks || [];
          dayTasks.forEach((task) => {
            if (!monthTasks.some((t) => t.taskId === task.taskId)) {
              monthTasks.push(task);
            }
          });
        }
      });

      return monthTasks;
    }
    return event.dataObj.tasks || [];
  };

  const tasksToShow = getTasksForTab();

  // Filter tasks based on status and search
  const getFilteredTasks = () => {
    let filtered = tasksToShow;

    // Apply status filter
    if (statusFilter === "pending") {
      filtered = filtered.filter((t) => normalize(t.status || "") !== "done");
    } else if (statusFilter === "completed") {
      filtered = filtered.filter((t) => normalize(t.status || "") === "done");
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((task) => {
        if (filterType === "name") {
          return String(task.name || "")
            .toLowerCase()
            .includes(query);
        } else {
          return String(task.taskId || "")
            .toLowerCase()
            .includes(query);
        }
      });
    }

    return filtered;
  };

  const filteredTasks = getFilteredTasks();
  const hasTasks = filteredTasks.length > 0;

  // Group tasks by frequency or leave status
  const groupedTasks = filteredTasks.reduce((groups, task) => {
    const isLeave = task.calendarType === "leave" || normalize(task.remarks || "").includes("leave");
    const groupKey = isLeave ? "leave" : freqMapKey(task.freq);
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(task);
    return groups;
  }, {});

  const allTasksCount = tasksToShow.filter(t => t.calendarType !== "leave" && !normalize(t.remarks || "").includes("leave") && !normalize(t.description || "").includes("leave")).length;
  const leaveTasksCount = tasksToShow.length - allTasksCount;

  // Format date for display
  const formatDateDisplay = (date) => {
    if (!date) return "";
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b-2 border-gray-200 p-4 sm:p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 truncate pr-2">
              📅 Tasks - {event.date}
              {lastWorkingDate && (
                <span className="text-sm font-normal text-gray-600 ml-2">
                  (Range: Today - {formatDateDisplay(lastWorkingDate)})
                </span>
              )}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
            >
              <svg
                className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Summary Boxes */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div 
              className="relative p-1.5 sm:p-2 rounded-xl border border-green-100 shadow-sm bg-gradient-to-br from-green-50 to-white transition-all duration-300"
            >
              <div className="flex items-center justify-between pl-1">
                <div className="flex flex-col">
                  <span className="text-[8px] sm:text-[9px] font-bold text-green-700 uppercase tracking-[0.05em] opacity-70">Active Tasks</span>
                  <span className="text-lg sm:text-xl font-extrabold text-green-600 leading-none">{allTasksCount}</span>
                </div>
                <div className="w-7 h-7 rounded-lg bg-white shadow-xs flex items-center justify-center text-green-500 border border-green-50/50">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
              </div>
              <div className="absolute top-0 left-0 w-0.5 h-full bg-green-500 rounded-l-xl"></div>
            </div>

            <div 
              className="relative p-1.5 sm:p-2 rounded-xl border border-red-100 shadow-sm bg-gradient-to-br from-red-50 to-white transition-all duration-300"
            >
              <div className="flex items-center justify-between pl-1">
                <div className="flex flex-col">
                  <span className="text-[8px] sm:text-[9px] font-bold text-red-700 uppercase tracking-[0.05em] opacity-70">Team on Leave</span>
                  <span className="text-lg sm:text-xl font-extrabold text-red-500 leading-none">{leaveTasksCount}</span>
                </div>
                <div className="w-7 h-7 rounded-lg bg-white shadow-xs flex items-center justify-center text-red-500 border border-red-50/50">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
              </div>
              <div className="absolute top-0 left-0 w-0.5 h-full bg-red-500 rounded-l-xl"></div>
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex flex-wrap gap-2 mb-3">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 sm:px-4 py-1.5 rounded-full font-medium transition-all text-xs sm:text-sm ${statusFilter === "all"
                ? "bg-gray-800 text-white shadow-sm"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
            >
              All Tasks
            </button>
            {/* <button
              onClick={() => setStatusFilter("pending")}
              className={`px-3 sm:px-4 py-1.5 rounded-lg font-medium transition-all text-xs sm:text-sm ${
                statusFilter === "pending"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setStatusFilter("completed")}
              className={`px-3 sm:px-4 py-1.5 rounded-lg font-medium transition-all text-xs sm:text-sm ${
                statusFilter === "completed"
                  ? "bg-green-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Completed
            </button> */}
          </div>

          {/* Search Filter */}
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="name">By Name</option>
              <option value="taskId">By Task ID</option>
            </select>
            <input
              type="text"
              placeholder={`Search by ${filterType === "name" ? "person name" : "task ID"
                }...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-3 sm:px-4 py-2 border border-gray-300 rounded-lg text-gray-700 placeholder-gray-400 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="px-3 sm:px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors text-xs sm:text-sm font-medium text-gray-700"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-3 sm:space-y-4 overflow-y-auto flex-1 bg-gray-50">
          {!hasTasks && (
            <div className="text-center py-8 sm:py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gray-200 rounded-full mb-4">
                <svg
                  className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              </div>
              <p className="text-gray-600 text-base sm:text-lg font-medium">
                No tasks found for selected filters
              </p>
            </div>
          )}

          {/* Group tasks by frequency */}
          {Object.keys(groupedTasks).map((frequency) => {
            const tasks = groupedTasks[frequency];
            if (tasks.length === 0) return null;

            return (
              <div key={frequency} className="mb-4 sm:mb-6">
                <div
                  className="flex items-center gap-2 mb-3 pb-2 border-b-2"
                  style={{ borderColor: freqColors[frequency] }}
                >
                  <div
                    className="w-3 h-3 sm:w-4 sm:h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: freqColors[frequency] }}
                  />
                  <h4 className="text-base sm:text-lg font-bold text-gray-800 truncate">
                    {freqLabels[frequency]} ({tasks.length})
                  </h4>
                </div>
                <div className="space-y-2 sm:space-y-3">
                  {tasks.map((t, i) => (
                    <div
                      key={`${frequency}-${t.taskId}-${i}`}
                      className="bg-white rounded-lg sm:rounded-xl p-3 sm:p-4 border-l-4 shadow-sm hover:shadow-md transition-shadow"
                      style={{ borderColor: freqColors[frequency] }}
                    >
                      <div className="flex items-start justify-between gap-2 sm:gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900 mb-2 text-sm sm:text-base break-words">
                            {t.description || t.name || "Task"}
                          </div>
                          <div className="flex flex-wrap gap-1.5 sm:gap-2 text-xs">
                            <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-md font-medium">
                              ID: {t.taskId}
                            </span>
                            {t.time && (
                              <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-md font-medium">
                                🕐 {t.time}
                              </span>
                            )}
                            <span
                              className={`px-2 py-1 rounded-md font-medium ${t.status === "done"
                                ? "bg-green-100 text-green-700"
                                : "bg-yellow-100 text-yellow-700"
                                }`}
                            >
                              {t.status === "done"
                                ? "✓ Completed"
                                : "🔄 Pending"}
                            </span>
                            <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-md font-medium truncate">
                              👤 {t.name || "N/A"}
                            </span>
                            {t.priority && t.priority !== "normal" && (
                              <span
                                className="px-2 py-1 rounded-md font-semibold text-white"
                                style={{
                                  backgroundColor:
                                    t.priority === "high"
                                      ? "#ef4444"
                                      : t.priority === "medium"
                                        ? "#f59e0b"
                                        : "#10b981",
                                }}
                              >
                                {formatIfDate(t.priority).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="mt-2 text-xs">
                            <span className="text-gray-500">
                              Frequency:{" "}
                              <span className="font-semibold">
                                {t.freq || "One-Time"}
                              </span>{" "}
                              • Next Occurrence:{" "}
                              <span className="font-semibold">
                                {formatDate(t.occurrenceDate || t.startDate)}
                              </span>
                            </span>
                          </div>
                          {t.remarks && (
                            <div className="mt-2 text-xs text-gray-600 italic bg-gray-50 px-2 py-1 rounded-md inline-block">
                              💬 {formatIfDate(t.remarks)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 bg-white border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full px-4 sm:px-6 py-2.5 sm:py-3 bg-gray-800 text-white rounded-full hover:bg-gray-900 transition-all duration-200 shadow-md hover:shadow-lg font-semibold text-sm sm:text-base"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CalendarUI;