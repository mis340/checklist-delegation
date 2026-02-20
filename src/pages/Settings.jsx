"use client";

import { useState, useEffect } from "react";
import { Search, ChevronDown, Edit2, Plus, X, Users, Building2, Loader2, Trash2, CalendarDays, ClipboardList, Paperclip, Bell, ArrowRightLeft } from "lucide-react";
import AdminLayout from "../components/layout/AdminLayout";

const SPREADSHEET_ID = "1pZx7O0Zfz52Gj-jon_UELVvueGcKPV2u0ONVq1IU3EU";
const SHEET_NAME = "Whatsapp";
const APPS_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbyaBCq6ZKHhOZBXRp9qw3hqrXh_aIOPvIHh_G41KtzPovhjl-UjEgj75Ok6gwJhrPOX/exec";

const Settings = () => {
    const [activeTab, setActiveTab] = useState("users");
    const [users, setUsers] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterText, setFilterText] = useState("");
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState({ show: false, message: "", type: "" });

    // Department management state
    const [deptSubTab, setDeptSubTab] = useState("departments");
    const [showDeptModal, setShowDeptModal] = useState(false);
    const [editingDept, setEditingDept] = useState(null);
    const [deptFormData, setDeptFormData] = useState({ departmentName: "", givenBy: "" });

    // Leave/Unique tasks state
    const [uniqueTasks, setUniqueTasks] = useState([]);
    const [loadingUnique, setLoadingUnique] = useState(false);
    const [selectedTasks, setSelectedTasks] = useState(new Set());

    // Leave Transfer Modal state
    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [leaveModalUser, setLeaveModalUser] = useState(null);
    const [leaveStartDate, setLeaveStartDate] = useState("");
    const [leaveEndDate, setLeaveEndDate] = useState("");
    const [checklistTasksForUser, setChecklistTasksForUser] = useState([]);
    const [loadingChecklistTasks, setLoadingChecklistTasks] = useState(false);
    const [selectedLeaveTasks, setSelectedLeaveTasks] = useState(new Set());
    const [submittingLeave, setSubmittingLeave] = useState(false);
    const [leaveFilter, setLeaveFilter] = useState("");

    const [formData, setFormData] = useState({
        department: "",
        givenBy: "",
        designation: "",
        username: "",
        password: "",
        role: "user",
        email: "",
        number: "",
    });

    // Fetch data from Google Sheet "Whatsapp" tab
    useEffect(() => {
        fetchData();
    }, []);

    // Fetch Unique tasks when Leave tab is selected
    useEffect(() => {
        if (activeTab === "leave" && uniqueTasks.length === 0) {
            fetchUniqueTasks();
        }
    }, [activeTab]);

    const fetchData = async () => {
        try {
            setLoading(true);

            const sheetUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${SHEET_NAME}`;
            const response = await fetch(sheetUrl);
            const text = await response.text();

            // Parse the Google Sheets JSON response
            const jsonString = text.substring(47).slice(0, -2);
            const data = JSON.parse(jsonString);

            const fetchedUsers = [];
            const deptSet = new Set();

            if (data.table && data.table.rows) {
                // Based on screenshot "Whatsapp" Sheet:
                // Col A (0): Department
                // Col B (1): Given By
                // Col C (2): Designation
                // Col D (3): Doer's Name (Username)
                // Col E (4): password
                // Col F (5): Role
                // Col G (6): ID (Email)
                // Col H (7): Number

                for (let i = 0; i < data.table.rows.length; i++) {
                    const row = data.table.rows[i];

                    // Skip empty rows or rows that look like headers (check if Department is "Department")
                    if (!row.c) continue;

                    const getValue = (index) => {
                        if (!row.c[index]) return "";
                        return String(row.c[index].v || "").trim();
                    };

                    const department = getValue(0);

                    // Skip header row if it's included in the data range
                    if (department === "Department") continue;

                    const user = {
                        rowIndex: i + 2, // Correct rowIndex: 0-based data index "i" corresponds to row i+2 in Sheet (Row 1 is Header)
                        department: department,
                        givenBy: getValue(1),
                        designation: getValue(2),
                        username: getValue(3), // Doer's Name
                        password: getValue(4),
                        role: getValue(5),
                        email: getValue(6),    // ID
                        number: getValue(7),
                    };

                    // Only add if there's at least a username/Doer's name
                    if (user.username) {
                        fetchedUsers.push(user);
                        if (user.department) {
                            deptSet.add(user.department);
                        }
                    }
                }
            }

            setUsers(fetchedUsers);
            setDepartments([...deptSet]);
        } catch (error) {
            console.error("Error fetching data:", error);
            showToast("Failed to fetch data. Please try again.", "error");
        } finally {
            setLoading(false);
        }
    };

    const showToast = (message, type) => {
        setToast({ show: true, message, type });
        setTimeout(() => {
            setToast({ show: false, message: "", type: "" });
        }, 4000);
    };

    // Fetch data from Google Sheet "UNIQUE" tab
    const fetchUniqueTasks = async () => {
        try {
            setLoadingUnique(true);
            const sheetUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=UNIQUE`;
            const response = await fetch(sheetUrl);
            const text = await response.text();
            const jsonString = text.substring(47).slice(0, -2);
            const data = JSON.parse(jsonString);

            const tasks = [];
            if (data.table && data.table.rows) {
                // Slice(1) to skip header row (Sheet Row 1), starting processing from Sheet Row 2
                const rows = data.table.rows.slice(1);

                rows.forEach((row, idx) => {
                    if (!row.c) return;

                    const getValue = (index) => {
                        if (!row.c[index]) return "";
                        if (row.c[index].f) return String(row.c[index].f).trim();
                        return String(row.c[index].v || "").trim();
                    };

                    // idx 0 corresponds to Sheet Row 2
                    const task = {
                        rowIndex: idx + 2,
                        taskId: getValue(1),
                        department: getValue(2),
                        givenBy: getValue(3),
                        name: getValue(4),
                        taskDescription: getValue(5),
                        endDate: getValue(6),
                        frequency: getValue(7),
                        reminders: getValue(8),
                        attachment: getValue(9),
                    };

                    if (task.taskId || task.department || task.name) {
                        tasks.push(task);
                    }
                });
            }
            setUniqueTasks(tasks);
        } catch (error) {
            console.error("Error fetching unique tasks:", error);
            showToast("Failed to fetch unique tasks.", "error");
        } finally {
            setLoadingUnique(false);
        }
    };

    // Fetch pending Checklist tasks for a specific user
    const fetchChecklistTasksForUser = async (userName) => {
        try {
            setLoadingChecklistTasks(true);
            const response = await fetch(
                `${APPS_SCRIPT_URL}?sheet=Checklist&action=fetch`
            );
            if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch {
                const jsonStart = text.indexOf("{");
                const jsonEnd = text.lastIndexOf("}");
                if (jsonStart !== -1 && jsonEnd !== -1) {
                    data = JSON.parse(text.substring(jsonStart, jsonEnd + 1));
                } else {
                    throw new Error("Invalid JSON response");
                }
            }

            let rows = [];
            if (data.table && data.table.rows) {
                rows = data.table.rows;
            } else if (Array.isArray(data)) {
                rows = data;
            } else if (data.values) {
                rows = data.values.map((row) => ({
                    c: row.map((val) => ({ v: val })),
                }));
            }

            const parseDate = (val) => {
                if (!val) return "";
                const s = String(val);
                if (s.startsWith("Date(")) {
                    const m = /Date\((\d+),(\d+),(\d+)\)/.exec(s);
                    if (m) {
                        return `${m[3].padStart(2, '0')}/${(parseInt(m[2]) + 1).toString().padStart(2, '0')}/${m[1]}`;
                    }
                }
                if (s.match(/^\d{2}\/\d{2}\/\d{4}/)) return s.split(' ')[0];
                try {
                    const d = new Date(s);
                    if (!isNaN(d.getTime())) {
                        return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
                    }
                } catch { }
                return s;
            };

            const tasks = [];
            rows.forEach((row, rowIndex) => {
                if (rowIndex === 0) return;
                let rowValues = [];
                if (row.c) {
                    rowValues = row.c.map((cell) =>
                        cell && cell.v !== undefined ? cell.v : ""
                    );
                } else if (Array.isArray(row)) {
                    rowValues = row;
                } else return;

                const assignedTo = (rowValues[4] || "").toString().trim();
                const columnKValue = (rowValues[10] || "").toString().trim();
                const isColumnKEmpty = columnKValue === "";
                const remarks = (rowValues[13] || "").toString().toLowerCase();

                // Show all tasks for this user (user requested "all task shows")
                if (assignedTo.toLowerCase() === userName.toLowerCase().trim()) {
                    // Column A (index 0) is the Timestamp/Date we want to filter on
                    const rawTimestamp = rowValues[0];
                    const timestampDate = parseDate(rawTimestamp);

                    let timestampJsDate = null;
                    if (timestampDate && timestampDate.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
                        const [dd, mm, yyyy] = timestampDate.split('/');
                        timestampJsDate = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
                    }

                    const rawDateVal = rowValues[6];
                    const formattedDate = parseDate(rawDateVal);

                    tasks.push({
                        rowIndex: rowIndex + 1,
                        taskId: rowValues[1] || "",
                        description: rowValues[5] || "",
                        date: formattedDate,
                        timestampDate: timestampDate,
                        timestampObj: timestampJsDate,
                        name: assignedTo,
                        isPending: isColumnKEmpty,
                        remarks: rowValues[13] || "",
                    });
                }
            });

            setChecklistTasksForUser(tasks);
        } catch (error) {
            console.error("Error fetching checklist tasks for user:", error);
            showToast("Failed to fetch tasks for this user.", "error");
        } finally {
            setLoadingChecklistTasks(false);
        }
    };

    // Open Leave Transfer Modal when checkbox is clicked on a task row
    const openLeaveTransferModal = (task) => {
        const today = new Date().toISOString().split('T')[0];
        setLeaveModalUser(task);
        setLeaveStartDate(today);
        setLeaveEndDate(today);
        setSelectedLeaveTasks(new Set());
        setShowLeaveModal(true);
        fetchChecklistTasksForUser(task.name);
    };

    const closeLeaveModal = () => {
        setShowLeaveModal(false);
        setLeaveModalUser(null);
        setChecklistTasksForUser([]);
        setSelectedLeaveTasks(new Set());
    };

    // Dynamically filter checklist tasks based on leave date range (using Column A/timestamp)
    const filteredChecklistTasks = (() => {
        if (!checklistTasksForUser.length) return [];

        if (!leaveStartDate && !leaveEndDate) {
            return checklistTasksForUser;
        }

        const startD = leaveStartDate ? new Date(leaveStartDate) : null;
        const endD = leaveEndDate ? new Date(leaveEndDate) : null;
        if (startD) startD.setHours(0, 0, 0, 0);
        if (endD) endD.setHours(23, 59, 59, 999);

        return checklistTasksForUser.filter(t => {
            if (!t.timestampObj) return false;
            if (startD && endD) return t.timestampObj >= startD && t.timestampObj <= endD;
            if (startD) return t.timestampObj >= startD;
            if (endD) return t.timestampObj <= endD;
            return true;
        });
    })();

    // Handle Leave Transfer Submit — writes remark to Column N of Checklist
    const handleLeaveSubmit = async () => {
        if (selectedLeaveTasks.size === 0) {
            showToast("Please select at least one task.", "error");
            return;
        }
        if (!leaveStartDate || !leaveEndDate) {
            showToast("Please select both leave start and end dates.", "error");
            return;
        }
        if (new Date(leaveStartDate) > new Date(leaveEndDate)) {
            showToast("Leave start date cannot be after end date.", "error");
            return;
        }

        setSubmittingLeave(true);
        try {
            const selectedTasksList = filteredChecklistTasks.filter(t =>
                selectedLeaveTasks.has(t.rowIndex)
            );

            const formatLeaveDate = (dateStr) => {
                const d = new Date(dateStr);
                return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
            };

            const remarkText = `Leave: ${formatLeaveDate(leaveStartDate)} to ${formatLeaveDate(leaveEndDate)}`;

            const now = new Date();
            const actualTimestamp = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

            const submissionData = selectedTasksList.map(task => ({
                taskId: task.taskId,
                rowIndex: task.rowIndex,
                remarks: remarkText,
                status: "Leave", // Optional: explicitly set status to "Leave" as well
                actualDate: actualTimestamp, // This maps to Column K (index-10) in the backend updateTaskData function
            }));

            console.log("Submitting Leave Remarks:", submissionData);

            // Use URLSearchParams for action/sheetName for reliable GAS parsing
            const params = new URLSearchParams();
            params.append("action", "updateTaskData");
            params.append("sheetName", "Checklist");
            params.append("rowData", JSON.stringify(submissionData));

            const response = await fetch(`${APPS_SCRIPT_URL}?${params.toString()}`, {
                method: "POST",
                headers: { "Content-Type": "text/plain" },
                body: "",
            });

            let result;
            try {
                result = await response.json();
            } catch (e) {
                console.error("JSON Parse Error:", e);
            }

            console.log("Full Server Response:", result);

            if (!result || result.success === false) {
                const errorMsg = result ? (result.error || result.message) : "Invalid server response";

                // Specific check to help debug deployment issues
                if (errorMsg && (errorMsg.includes("Unknown action") || errorMsg.includes("script is outdated") || errorMsg.includes("is not defined"))) {
                    const msg = "⚠️ BACKEND UPDATE REQUIRED ⚠️\n\nThe Google Apps Script code is outdated or incomplete.\n\nYOU MUST:\n1. Copy the FULL code provided by the AI.\n2. Paste it into Apps Script (overwrite everything).\n3. Click 'Deploy' > 'Manage deployments'.\n4. Click Pencil Icon ✏️ > Select 'New version' 🆕 > Click 'Deploy'.";
                    alert(msg);
                    throw new Error("Backend script is outdated. Please deploy a NEW version.");
                }
                throw new Error(errorMsg || "Backend error");
            }

            showToast(`Leave submitted for ${selectedTasksList.length} task(s)!`, "success");
            closeLeaveModal();
        } catch (error) {
            console.error("Leave submit error:", error);
            showToast("Failed to submit leave: " + error.message, "error");
        } finally {
            setSubmittingLeave(false);
        }
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const resetForm = () => {
        setFormData({
            department: "",
            givenBy: "",
            designation: "",
            username: "",
            password: "",
            role: "user",
            email: "",
            number: "",
        });
        setEditingUser(null);
    };

    const openAddModal = () => {
        resetForm();
        setShowAddModal(true);
    };

    const openEditModal = (user) => {
        setFormData({
            department: user.department,
            givenBy: user.givenBy,
            designation: user.designation,
            username: user.username,
            password: user.password,
            role: user.role,
            email: user.email,
            number: user.number,
        });
        setEditingUser(user);
        setShowAddModal(true);
    };

    const closeModal = () => {
        setShowAddModal(false);
        resetForm();
    };

    // Save user (add/edit) to Google Sheet "Whatsapp" via Apps Script
    const handleSaveUser = async (e) => {
        e.preventDefault();
        setSaving(true);

        const previousUsers = [...users];
        const isEditMode = !!editingUser;
        const targetRowIndex = editingUser
            ? editingUser.rowIndex
            : (users.length > 0 ? Math.max(...users.map(u => u.rowIndex)) + 1 : 2);

        try {
            // Row data array matching sheet column order exactly:
            // A: Department, B: Given By, C: Designation, D: Doer's Name,
            // E: password, F: Role, G: ID (Email), H: Number
            const rowDataArray = [
                formData.department || "",
                formData.givenBy || "",
                formData.designation || "",
                formData.username || "",
                formData.password || "",
                formData.role || "",
                formData.email || "",
                formData.number || ""
            ];

            // 1. Optimistic update - show in frontend immediately
            if (isEditMode) {
                setUsers(prev => prev.map(user =>
                    user.rowIndex === targetRowIndex ? { ...user, ...formData } : user
                ));
            } else {
                setUsers(prev => [...prev, { rowIndex: targetRowIndex, ...formData }]);
            }

            showToast(isEditMode ? "Saving changes..." : "Adding user...", "success");
            closeModal();

            // 2. Build URL with query parameters (reliable for Google Apps Script)
            const params = new URLSearchParams();
            params.append("action", isEditMode ? "update" : "insert");
            params.append("sheetName", SHEET_NAME);
            params.append("rowData", JSON.stringify(rowDataArray));
            if (isEditMode) {
                params.append("rowIndex", String(targetRowIndex));
            }
            // Tell backend NOT to format any column as date
            params.append("timestampColumn", "-1");

            const url = `${APPS_SCRIPT_URL}?${params.toString()}`;

            console.log("Submitting user data:", { isEditMode, sheetName: SHEET_NAME, rowDataArray, targetRowIndex });

            // 3. Use POST with URL params (Google Apps Script reads e.parameter from both URL and body)
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "text/plain" },
                body: "",
            });

            let result;
            try {
                result = await response.json();
                console.log("Apps Script response:", result);
            } catch (parseErr) {
                console.log("Response status:", response.status, "- could not parse JSON, but request was sent");
            }

            if (result && result.success === false) {
                throw new Error(result.error || result.message || "Backend error");
            }

            showToast(isEditMode ? "User updated!" : "User added!", "success");

            // 4. Re-fetch to confirm data persisted
            setTimeout(() => fetchData(), 2500);

        } catch (error) {
            console.error("Error saving user:", error);
            setUsers(previousUsers);
            showToast("Failed to save: " + error.message, "error");
        } finally {
            setSaving(false);
        }
    };

    // Filter users by username
    const filteredUsers = users.filter((user) =>
        user.username.toLowerCase().includes(filterText.toLowerCase())
    );

    // Get unique departments and givenBy for the Departments tab
    const departmentList = departments.map((dept) => ({
        name: dept,
        userCount: users.filter((u) => u.department === dept).length,
    }));

    // Unique "Given By" list
    const givenByList = [...new Set(users.map(u => u.givenBy).filter(Boolean))];

    // Department modal handlers
    const openAddDeptModal = () => {
        setDeptFormData({ departmentName: "", givenBy: "" });
        setEditingDept(null);
        setShowDeptModal(true);
    };

    const openEditDeptModal = (name, type) => {
        if (type === "department") {
            setDeptFormData({ departmentName: name, givenBy: "" });
        } else {
            setDeptFormData({ departmentName: "", givenBy: name });
        }
        setEditingDept({ name, type });
        setShowDeptModal(true);
    };

    const closeDeptModal = () => {
        setShowDeptModal(false);
        setEditingDept(null);
        setDeptFormData({ departmentName: "", givenBy: "" });
    };

    const handleSaveDepartment = async (e) => {
        e.preventDefault();
        // For now, department data is derived from users. 
        // Save as a new user row with the department/givenBy info.
        if (editingDept) {
            // Update all users with old dept/givenBy name to new name
            const oldName = editingDept.name;
            const field = editingDept.type === "department" ? "department" : "givenBy";
            const newName = editingDept.type === "department" ? deptFormData.departmentName : deptFormData.givenBy;

            if (!newName.trim()) {
                showToast("Name cannot be empty", "error");
                return;
            }

            setUsers(prev => prev.map(user =>
                user[field] === oldName ? { ...user, [field]: newName } : user
            ));
            setDepartments(prev => {
                if (field === "department") {
                    return prev.map(d => d === oldName ? newName : d);
                }
                return prev;
            });
            showToast(`${editingDept.type === "department" ? "Department" : "Given By"} updated!`, "success");
        } else {
            // Add new department/givenBy
            if (deptFormData.departmentName.trim()) {
                if (!departments.includes(deptFormData.departmentName.trim())) {
                    setDepartments(prev => [...prev, deptFormData.departmentName.trim()]);
                }
            }
            showToast("Department added!", "success");
        }
        closeDeptModal();
    };

    const getRoleBadgeClass = (role) => {
        const normalizedRole = (role || "").toLowerCase().trim();
        if (normalizedRole === "admin") {
            return "bg-gradient-to-r from-purple-500 to-indigo-500 text-white";
        }
        return "bg-gradient-to-r from-blue-100 to-blue-200 text-blue-700";
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good Morning";
        if (hour < 17) return "Good Afternoon";
        return "Good Evening";
    };

    const username = sessionStorage.getItem("username") || "User";

    return (
        <AdminLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-xl md:text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-transparent bg-clip-text">
                            {getGreeting()}, {username.toUpperCase()}
                        </h1>
                        <p className="text-xs md:text-sm text-gray-500 mt-1">
                            Manage your organization's users and departments
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 md:gap-3">
                        {/* Tab Buttons */}
                        <button
                            onClick={() => setActiveTab("users")}
                            className={`flex items-center gap-2 px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-medium text-xs md:text-sm transition-all duration-200 ${activeTab === "users"
                                ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-200"
                                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                                }`}
                        >
                            <Users className="w-3 h-3 md:w-4 md:h-4" />
                            Users
                        </button>
                        <button
                            onClick={() => setActiveTab("departments")}
                            className={`flex items-center gap-2 px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-medium text-xs md:text-sm transition-all duration-200 ${activeTab === "departments"
                                ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-200"
                                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                                }`}
                        >
                            <Building2 className="w-3 h-3 md:w-4 md:h-4" />
                            Departments
                        </button>
                        <button
                            onClick={() => setActiveTab("leave")}
                            className={`flex items-center gap-2 px-4 py-2 md:px-5 md:py-2.5 rounded-lg font-medium text-xs md:text-sm transition-all duration-200 ${activeTab === "leave"
                                ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-200"
                                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                                }`}
                        >
                            <ClipboardList className="w-3 h-3 md:w-4 md:h-4" />
                            Leave
                        </button>
                        {activeTab === "users" && (
                            <button
                                onClick={openAddModal}
                                className="flex items-center gap-2 px-4 py-2 md:px-5 md:py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium text-xs md:text-sm shadow-lg shadow-blue-200 hover:shadow-xl hover:scale-[1.02] transition-all duration-200 ml-auto md:ml-0"
                            >
                                <Plus className="w-3 h-3 md:w-4 md:h-4" />
                                Add User
                            </button>
                        )}
                        {activeTab === "departments" && (
                            <button
                                onClick={openAddDeptModal}
                                className="flex items-center gap-2 px-4 py-2 md:px-5 md:py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium text-xs md:text-sm shadow-lg shadow-purple-200 hover:shadow-xl hover:scale-[1.02] transition-all duration-200 ml-auto md:ml-0"
                            >
                                <Plus className="w-3 h-3 md:w-4 md:h-4" />
                                Add Department
                            </button>
                        )}
                    </div>
                </div>

                {/* Content Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    {activeTab === "users" && (
                        <>
                            {/* User List Header */}
                            <div className="flex flex-col md:flex-row md:items-center justify-between p-4 md:p-5 border-b border-gray-100 gap-4">
                                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                    <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full"></div>
                                    User List
                                </h2>
                                <div className="relative w-full md:w-auto">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Filter by name..."
                                        value={filterText}
                                        onChange={(e) => setFilterText(e.target.value)}
                                        className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent w-full md:w-64 transition-all duration-200"
                                    />
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                </div>
                            </div>

                            {/* Desktop Table - Hidden on Mobile */}
                            {loading ? (
                                <div className="flex items-center justify-center py-20">
                                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                                    <span className="ml-3 text-gray-500 font-medium">Loading users...</span>
                                </div>
                            ) : (
                                <>
                                    <div className="hidden md:block overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="bg-gradient-to-r from-gray-50 to-gray-100/50">
                                                    <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                        Department
                                                    </th>
                                                    <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                        Given By
                                                    </th>
                                                    <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                        Designation
                                                    </th>
                                                    <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                        Doer's Name
                                                    </th>
                                                    <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                        Password
                                                    </th>
                                                    <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                        Role
                                                    </th>
                                                    <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                        ID
                                                    </th>
                                                    <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                        Number
                                                    </th>
                                                    <th className="px-5 py-3.5 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                        Actions
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {filteredUsers.length === 0 ? (
                                                    <tr>
                                                        <td
                                                            colSpan={9}
                                                            className="px-5 py-12 text-center text-gray-400"
                                                        >
                                                            <div className="flex flex-col items-center gap-2">
                                                                <Users className="w-10 h-10 text-gray-300" />
                                                                <p className="font-medium">No users found</p>
                                                                <p className="text-sm">
                                                                    {filterText
                                                                        ? "Try a different search term"
                                                                        : "Add a new user to get started"}
                                                                </p>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    filteredUsers.map((user, index) => (
                                                        <tr
                                                            key={index}
                                                            className="hover:bg-blue-50/40 transition-colors duration-150"
                                                        >
                                                            <td className="px-5 py-3.5 text-sm font-medium text-gray-800">
                                                                {user.department}
                                                            </td>
                                                            <td className="px-5 py-3.5 text-sm text-gray-600">
                                                                {user.givenBy}
                                                            </td>
                                                            <td className="px-5 py-3.5 text-sm text-gray-600">
                                                                {user.designation}
                                                            </td>
                                                            <td className="px-5 py-3.5 text-sm font-semibold text-gray-800">
                                                                {user.username}
                                                            </td>
                                                            <td className="px-5 py-3.5 text-sm text-gray-600">
                                                                {user.password}
                                                            </td>
                                                            <td className="px-5 py-3.5">
                                                                <span
                                                                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getRoleBadgeClass(
                                                                        user.role
                                                                    )}`}
                                                                >
                                                                    {user.role || "user"}
                                                                </span>
                                                            </td>
                                                            <td className="px-5 py-3.5 text-sm text-blue-600">
                                                                {user.email}
                                                            </td>
                                                            <td className="px-5 py-3.5 text-sm text-gray-600">
                                                                {user.number}
                                                            </td>
                                                            <td className="px-5 py-3.5 text-center">
                                                                <button
                                                                    onClick={() => openEditModal(user)}
                                                                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-blue-500 hover:text-blue-700 hover:bg-blue-100 transition-all duration-200"
                                                                    title="Edit user"
                                                                >
                                                                    <Edit2 className="w-4 h-4" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Mobile Card View - Shown only on Mobile */}
                                    <div className="md:hidden grid grid-cols-1 gap-4 p-4">
                                        {filteredUsers.length === 0 ? (
                                            <div className="text-center py-12 text-gray-400">
                                                <Users className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                                                <p className="font-medium">No users found</p>
                                            </div>
                                        ) : (
                                            filteredUsers.map((user, index) => (
                                                <div key={index} className="bg-white rounded-lg border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div>
                                                            <h3 className="font-semibold text-gray-800">{user.username}</h3>
                                                            <p className="text-xs text-gray-500">{user.designation}</p>
                                                        </div>
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getRoleBadgeClass(user.role)}`}>
                                                            {user.role}
                                                        </span>
                                                    </div>

                                                    <div className="space-y-2 text-sm text-gray-600">
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-400 text-xs">Department:</span>
                                                            <span className="font-medium text-right">{user.department}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-400 text-xs">ID/Email:</span>
                                                            <span className="text-right break-all ml-2">{user.email}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-400 text-xs">Given By:</span>
                                                            <span className="text-right">{user.givenBy}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-400 text-xs">Number:</span>
                                                            <span className="text-right">{user.number}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-gray-400 text-xs">Password:</span>
                                                            <span className="text-right font-mono text-xs">{user.password}</span>
                                                        </div>
                                                    </div>

                                                    <div className="mt-4 pt-3 border-t border-gray-50 flex justify-end">
                                                        <button
                                                            onClick={() => openEditModal(user)}
                                                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                            Edit Profile
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </>
                            )}
                        </>
                    )}

                    {activeTab === "departments" && (
                        <div className="p-5">
                            {/* Department Management Header with Sub-tabs */}
                            <div className="flex flex-col md:flex-row md:items-center justify-between mb-5 gap-3">
                                <h2 className="text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 text-transparent bg-clip-text flex items-center gap-2">
                                    Department Management
                                </h2>
                                <div className="flex bg-gray-100 rounded-lg p-0.5">
                                    <button
                                        onClick={() => setDeptSubTab("departments")}
                                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${deptSubTab === "departments"
                                            ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md"
                                            : "text-gray-600 hover:text-gray-800"
                                            }`}
                                    >
                                        Departments
                                    </button>
                                    <button
                                        onClick={() => setDeptSubTab("givenBy")}
                                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${deptSubTab === "givenBy"
                                            ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md"
                                            : "text-gray-600 hover:text-gray-800"
                                            }`}
                                    >
                                        Given By
                                    </button>
                                </div>
                            </div>

                            {loading ? (
                                <div className="flex items-center justify-center py-20">
                                    <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                                    <span className="ml-3 text-gray-500 font-medium">Loading...</span>
                                </div>
                            ) : deptSubTab === "departments" ? (
                                /* Departments Table */
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-gray-200">
                                                <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">ID</th>
                                                <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Department Name</th>
                                                <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {departmentList.length === 0 ? (
                                                <tr>
                                                    <td colSpan={3} className="px-5 py-12 text-center text-gray-400">
                                                        <Building2 className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                                                        <p className="font-medium">No departments found</p>
                                                    </td>
                                                </tr>
                                            ) : (
                                                departmentList.map((dept, index) => (
                                                    <tr key={index} className="hover:bg-purple-50/40 transition-colors duration-150">
                                                        <td className="px-5 py-4 text-sm font-semibold text-purple-600">{index + 1}</td>
                                                        <td className="px-5 py-4 text-sm font-semibold text-gray-800">{dept.name}</td>
                                                        <td className="px-5 py-4">
                                                            <button
                                                                onClick={() => openEditDeptModal(dept.name, "department")}
                                                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-purple-500 hover:text-purple-700 hover:bg-purple-100 transition-all duration-200"
                                                                title="Edit department"
                                                            >
                                                                <Edit2 className="w-4 h-4" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                /* Given By Table */
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-gray-200">
                                                <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">ID</th>
                                                <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Given By</th>
                                                <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {givenByList.length === 0 ? (
                                                <tr>
                                                    <td colSpan={3} className="px-5 py-12 text-center text-gray-400">
                                                        <Users className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                                                        <p className="font-medium">No entries found</p>
                                                    </td>
                                                </tr>
                                            ) : (
                                                givenByList.map((name, index) => (
                                                    <tr key={index} className="hover:bg-purple-50/40 transition-colors duration-150">
                                                        <td className="px-5 py-4 text-sm font-semibold text-purple-600">{index + 1}</td>
                                                        <td className="px-5 py-4 text-sm font-semibold text-gray-800">{name}</td>
                                                        <td className="px-5 py-4">
                                                            <button
                                                                onClick={() => openEditDeptModal(name, "givenBy")}
                                                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-purple-500 hover:text-purple-700 hover:bg-purple-100 transition-all duration-200"
                                                                title="Edit given by"
                                                            >
                                                                <Edit2 className="w-4 h-4" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "leave" && (
                        <>
                            {/* Leave / Unique Tasks Header */}
                            {/* <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-purple-500 px-5 py-3">
                                <h2 className="text-sm font-bold text-white">All Unique Tasks</h2>
                                <p className="text-[11px] text-blue-100 mt-0.5">Showing all unique tasks from checklist</p>
                            </div> */}

                            {loadingUnique ? (
                                <div className="flex items-center justify-center py-20">
                                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                                    <span className="ml-3 text-gray-500 font-medium">Loading unique tasks...</span>
                                </div>
                            ) : (
                                <>
                                    {/* Desktop Table */}
                                    <div className="hidden md:block overflow-x-auto max-h-[75vh] overflow-y-auto border border-gray-200 rounded-lg">
                                        <table className="w-full text-[13px]">
                                            <thead>
                                                <tr className="bg-gray-50 border-b border-gray-200">
                                                    <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap sticky top-0 z-10 bg-gray-50 shadow-sm">
                                                        <div className="flex items-center gap-1.5">
                                                            Action
                                                        </div>
                                                    </th>
                                                    <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap sticky top-0 z-10 bg-gray-50 shadow-sm">Department</th>
                                                    <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap sticky top-0 z-10 bg-gray-50 shadow-sm">Given By</th>
                                                    <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap sticky top-0 z-10 bg-gray-50 shadow-sm">Name</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {(() => {
                                                    const seen = new Set();
                                                    const filtered = uniqueTasks.filter(t =>
                                                        !leaveFilter ||
                                                        t.name.toLowerCase().includes(leaveFilter.toLowerCase()) ||
                                                        t.department.toLowerCase().includes(leaveFilter.toLowerCase()) ||
                                                        t.taskDescription.toLowerCase().includes(leaveFilter.toLowerCase()) ||
                                                        t.taskId.toLowerCase().includes(leaveFilter.toLowerCase())
                                                    );
                                                    const deduplicated = filtered.filter(t => {
                                                        if (seen.has(t.name)) return false;
                                                        seen.add(t.name);
                                                        return true;
                                                    });

                                                    if (deduplicated.length === 0) {
                                                        return (
                                                            <tr>
                                                                <td colSpan={4} className="px-4 py-10 text-center text-gray-400">
                                                                    <ClipboardList className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                                                    <p className="text-sm font-medium">No tasks found</p>
                                                                </td>
                                                            </tr>
                                                        );
                                                    }

                                                    return deduplicated.map((task, index) => (
                                                        <tr key={index} className="hover:bg-blue-50/30 transition-colors">
                                                            <td className="px-3 py-2 text-center">
                                                                <input
                                                                    type="checkbox"
                                                                    className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                                    checked={selectedTasks.has(task.rowIndex)}
                                                                    onChange={() => openLeaveTransferModal(task)}
                                                                />
                                                            </td>
                                                            <td className="px-3 py-2 font-semibold text-gray-700">{task.department}</td>
                                                            <td className="px-3 py-2 text-gray-600">{task.givenBy}</td>
                                                            <td className="px-3 py-2 text-gray-600">{task.name}</td>
                                                        </tr>
                                                    ));
                                                })()}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Mobile Card View */}
                                    <div className="md:hidden divide-y divide-gray-100">
                                        {(() => {
                                            const seen = new Set();
                                            const filtered = uniqueTasks.filter(t =>
                                                !leaveFilter ||
                                                t.name.toLowerCase().includes(leaveFilter.toLowerCase()) ||
                                                t.department.toLowerCase().includes(leaveFilter.toLowerCase()) ||
                                                t.taskDescription.toLowerCase().includes(leaveFilter.toLowerCase())
                                            );
                                            const deduplicated = filtered.filter(t => {
                                                if (seen.has(t.name)) return false;
                                                seen.add(t.name);
                                                return true;
                                            });

                                            if (deduplicated.length === 0) {
                                                return (
                                                    <div className="text-center py-10 text-gray-400">
                                                        <ClipboardList className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                                        <p className="text-sm font-medium">No tasks found</p>
                                                    </div>
                                                );
                                            }

                                            return deduplicated.map((task, index) => (
                                                <div key={index} className="px-4 py-3">
                                                    <div className="flex items-start gap-3">
                                                        <input
                                                            type="checkbox"
                                                            className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-0.5 cursor-pointer"
                                                            checked={selectedTasks.has(task.rowIndex)}
                                                            onChange={() => openLeaveTransferModal(task)}
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-semibold text-gray-800 mt-0.5">{task.name}</p>
                                                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-gray-500">
                                                                <span><strong>Dept:</strong> {task.department}</span>
                                                                <span><strong>By:</strong> {task.givenBy}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                </>
                            )}
                        </>
                    )}

                    {/* ===== LEAVE TRANSFER MODAL ===== */}
                    {showLeaveModal && leaveModalUser && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-auto flex flex-col max-h-[90vh] transform transition-all duration-300 animate-fadeIn">
                                {/* Modal Header — always visible */}
                                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
                                    <h3 className="text-lg font-bold text-gray-800">
                                        Transfer Tasks for {leaveModalUser.name}
                                    </h3>
                                    <button
                                        onClick={closeLeaveModal}
                                        className="text-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Scrollable body */}
                                <div className="overflow-y-auto flex-1 p-6 space-y-5">
                                    {/* Leave Start Date */}
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                                            Leave Start Date <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            value={leaveStartDate}
                                            onChange={(e) => {
                                                setLeaveStartDate(e.target.value);
                                                setSelectedLeaveTasks(new Set());
                                            }}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                                            required
                                        />
                                    </div>

                                    {/* Leave End Date */}
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                                            Leave End Date <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            value={leaveEndDate}
                                            onChange={(e) => {
                                                setLeaveEndDate(e.target.value);
                                                setSelectedLeaveTasks(new Set());
                                            }}
                                            min={leaveStartDate || undefined}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                                            required
                                        />
                                    </div>

                                    {/* Date validation message */}
                                    {leaveStartDate && leaveEndDate && new Date(leaveStartDate) > new Date(leaveEndDate) && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
                                            <p className="text-xs text-amber-700 font-medium">⚠️ Start date cannot be after end date.</p>
                                        </div>
                                    )}

                                    {/* Tasks to Assign — sticky header */}
                                    <div>
                                        <div className="sticky top-0 z-10 bg-white pb-2">
                                            <label className="block text-sm font-semibold text-gray-700">
                                                Tasks to Assign ({loadingChecklistTasks ? "..." : filteredChecklistTasks.length})
                                            </label>
                                        </div>

                                        {loadingChecklistTasks ? (
                                            <div className="flex items-center justify-center py-8">
                                                <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                                                <span className="ml-2 text-gray-500 text-sm">Loading tasks...</span>
                                            </div>
                                        ) : filteredChecklistTasks.length === 0 ? (
                                            <div className="text-center py-6 text-gray-400 border border-dashed border-gray-200 rounded-lg">
                                                <ClipboardList className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                                <p className="text-sm">
                                                    {checklistTasksForUser.length === 0
                                                        ? "No pending tasks found for this user"
                                                        : "No tasks match the selected date range"}
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                                                <div className="max-h-[340px] overflow-y-auto">
                                                    <table className="w-full text-sm">
                                                        <thead className="sticky top-0 z-10">
                                                            <tr className="bg-gray-50 border-b border-gray-200">
                                                                <th className="px-3 py-2 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-10">
                                                                    <input
                                                                        type="checkbox"
                                                                        className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                                        checked={selectedLeaveTasks.size === filteredChecklistTasks.length && filteredChecklistTasks.length > 0}
                                                                        onChange={(e) => {
                                                                            if (e.target.checked) {
                                                                                setSelectedLeaveTasks(new Set(filteredChecklistTasks.map(t => t.rowIndex)));
                                                                            } else {
                                                                                setSelectedLeaveTasks(new Set());
                                                                            }
                                                                        }}
                                                                    />
                                                                </th>
                                                                <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Task ID</th>
                                                                <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                                                                <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100">
                                                            {filteredChecklistTasks.map((ct, idx) => (
                                                                <tr key={idx} className={`hover:bg-blue-50/30 transition-colors ${selectedLeaveTasks.has(ct.rowIndex) ? 'bg-blue-50/50' : ''}`}>
                                                                    <td className="px-3 py-2 text-center">
                                                                        <input
                                                                            type="checkbox"
                                                                            className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                                            checked={selectedLeaveTasks.has(ct.rowIndex)}
                                                                            onChange={(e) => {
                                                                                const next = new Set(selectedLeaveTasks);
                                                                                if (e.target.checked) next.add(ct.rowIndex);
                                                                                else next.delete(ct.rowIndex);
                                                                                setSelectedLeaveTasks(next);
                                                                            }}
                                                                        />
                                                                    </td>
                                                                    <td className="px-3 py-2 font-semibold text-gray-700">{ct.taskId}</td>
                                                                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{ct.date}</td>
                                                                    <td className="px-3 py-2 text-gray-600">
                                                                        <span className="line-clamp-2">{ct.description}</span>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Note */}
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                                        <p className="text-xs text-blue-700">
                                            <strong>Note:</strong> Selected tasks will be marked with the leave remark in the Checklist sheet (Column N) for <strong>{leaveModalUser.name}</strong>.
                                        </p>
                                    </div>
                                </div>

                                {/* Footer — always visible */}
                                <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 shrink-0 bg-gray-50/50">
                                    <span className="text-xs text-gray-500">
                                        {selectedLeaveTasks.size > 0 ? `${selectedLeaveTasks.size} task(s) selected` : "No tasks selected"}
                                    </span>
                                    <div className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={closeLeaveModal}
                                            className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleLeaveSubmit}
                                            disabled={submittingLeave || selectedLeaveTasks.size === 0 || !leaveStartDate || !leaveEndDate || (leaveStartDate && leaveEndDate && new Date(leaveStartDate) > new Date(leaveEndDate))}
                                            className="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-red-500 to-rose-600 rounded-lg hover:shadow-lg disabled:opacity-50 transition-all duration-200 flex items-center gap-2"
                                        >
                                            {submittingLeave ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Submitting...
                                                </>
                                            ) : (
                                                <>
                                                    <ArrowRightLeft className="w-4 h-4" />
                                                    Leave
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Add/Edit Department Modal */}
            {showDeptModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-auto overflow-hidden transform transition-all duration-300 animate-fadeIn">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <h3 className="text-lg font-bold text-gray-800">
                                {editingDept ? `Edit ${editingDept.type === "department" ? "Department" : "Given By"}` : "Create New Department"}
                            </h3>
                            <button
                                onClick={closeDeptModal}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveDepartment} className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Department Name
                                </label>
                                <input
                                    type="text"
                                    value={deptFormData.departmentName}
                                    onChange={(e) => setDeptFormData(prev => ({ ...prev, departmentName: e.target.value }))}
                                    placeholder="Enter department name"
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-all"
                                    required={!editingDept || editingDept.type === "department"}
                                    disabled={editingDept && editingDept.type === "givenBy"}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Given By
                                </label>
                                <input
                                    type="text"
                                    value={deptFormData.givenBy}
                                    onChange={(e) => setDeptFormData(prev => ({ ...prev, givenBy: e.target.value }))}
                                    placeholder="Enter Given By"
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-all"
                                    required={editingDept && editingDept.type === "givenBy"}
                                    disabled={editingDept && editingDept.type === "department"}
                                />
                            </div>
                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={closeDeptModal}
                                    className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg hover:shadow-lg transition-all duration-200 flex items-center gap-2"
                                >
                                    <Building2 className="w-4 h-4" />
                                    Save Department
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add/Edit User Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-auto overflow-y-auto max-h-[90vh] transform transition-all duration-300 animate-fadeIn">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 sticky top-0 z-10">
                            <h3 className="text-lg font-bold text-white">
                                {editingUser ? "Edit User" : "Add New User"}
                            </h3>
                            <button
                                onClick={closeModal}
                                className="text-white/80 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleSaveUser} className="p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Department
                                    </label>
                                    <input
                                        type="text"
                                        name="department"
                                        value={formData.department}
                                        onChange={handleFormChange}
                                        placeholder="e.g. Sales"
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Given By
                                    </label>
                                    <input
                                        type="text"
                                        name="givenBy"
                                        value={formData.givenBy}
                                        onChange={handleFormChange}
                                        placeholder="e.g. Admin"
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Designation
                                    </label>
                                    <input
                                        type="text"
                                        name="designation"
                                        value={formData.designation}
                                        onChange={handleFormChange}
                                        placeholder="e.g. Manager"
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Doer's Name (Username)
                                    </label>
                                    <input
                                        type="text"
                                        name="username"
                                        value={formData.username}
                                        onChange={handleFormChange}
                                        placeholder="Enter name"
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Password
                                    </label>
                                    <input
                                        type="text"
                                        name="password"
                                        value={formData.password}
                                        onChange={handleFormChange}
                                        placeholder="Enter password"
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Role
                                    </label>
                                    <select
                                        name="role"
                                        value={formData.role}
                                        onChange={handleFormChange}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all bg-white"
                                    >
                                        <option value="user">User</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        ID (Email)
                                    </label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleFormChange}
                                        placeholder="Enter email"
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Number
                                    </label>
                                    <input
                                        type="text"
                                        name="number"
                                        value={formData.number}
                                        onChange={handleFormChange}
                                        placeholder="Phone number"
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                                    />
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg hover:shadow-lg disabled:opacity-50 transition-all duration-200 flex items-center gap-2"
                                >
                                    {saving ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Saving...
                                        </>
                                    ) : editingUser ? (
                                        "Update User"
                                    ) : (
                                        "Add User"
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Toast Notification */}
            {toast.show && (
                <div
                    className={`fixed bottom-6 right-6 px-5 py-3.5 rounded-xl shadow-2xl transition-all duration-300 z-50 flex items-center gap-3 ${toast.type === "success"
                        ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white"
                        : "bg-gradient-to-r from-red-500 to-rose-500 text-white"
                        }`}
                >
                    {toast.type === "success" ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    )}
                    <span className="font-medium">{toast.message}</span>
                </div>
            )}
        </AdminLayout>
    );
};

export default Settings;
