import React, { useState, useEffect } from "react";
import "./Holiday.css";
import AdminLayout from "../../components/layout/AdminLayout";
import { Pencil, Trash2, Download } from "lucide-react";

const Holiday = () => {
  const [holidays, setHolidays] = useState(() => {
    const saved = localStorage.getItem("holidays");
    return saved ? JSON.parse(saved) : [];
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [formData, setFormData] = useState({ day: "", date: "", name: "" });
  const [loading, setLoading] = useState(false);

  // Fetch holidays from Google Sheet on component mount
  useEffect(() => {
    fetchHolidaysFromSheet();
  }, []);

  const fetchHolidaysFromSheet = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        "https://script.google.com/macros/s/AKfycbyaBCq6ZKHhOZBXRp9qw3hqrXh_aIOPvIHh_G41KtzPovhjl-UjEgj75Ok6gwJhrPOX/exec?sheet=Working Day Calendar&action=fetch",
      );
      const data = await response.json();

      if (data.table && data.table.rows) {
        // Skip header row (row 0) and process data
        const sheetHolidays = [];
        for (let i = 1; i < data.table.rows.length; i++) {
          const row = data.table.rows[i];
          const dateValue = row.c[5]?.v; // Column F (index 5) - Date
          const dayValue = row.c[6]?.v; // Column G (index 6) - Day
          const holidayValue = row.c[7]?.v; // Column H (index 7) - Holiday Reason

          // Only add if there's a holiday value
          if (holidayValue && holidayValue.trim() !== "") {
            sheetHolidays.push({
              date: formatDateFromSheet(dateValue), // Format to DD-MM-YYYY
              day: dayValue || "",
              name: holidayValue || "",
            });
          }
        }

        setHolidays(sheetHolidays);
        localStorage.setItem("holidays", JSON.stringify(sheetHolidays));
      }
    } catch (error) {
      console.error("Failed to fetch holidays from sheet:", error);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to format date from sheet
  const formatDateFromSheet = (dateValue) => {
    if (!dateValue) return "";

    // If it's already in DD-MM-YYYY format
    if (typeof dateValue === "string" && dateValue.includes("-")) {
      return dateValue;
    }

    // If it's a Date object or different format
    try {
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
      }
    } catch (e) {
      console.error("Error formatting date:", e);
    }

    return dateValue.toString();
  };

  // Save to localStorage whenever holidays change
  useEffect(() => {
    localStorage.setItem("holidays", JSON.stringify(holidays));
  }, [holidays]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.day || !formData.date || !formData.name) {
      alert("Please fill all fields!");
      return;
    }

    // Convert date from YYYY-MM-DD to DD-MM-YYYY for sheet
    const [year, month, day] = formData.date.split("-");
    const formattedDate = `${day}-${month}-${year}`;

    // Save in UI state first
    const updatedHolidays = [...holidays];
    if (editIndex !== null) {
      updatedHolidays[editIndex] = { ...formData, date: formattedDate };
    } else {
      updatedHolidays.push({ ...formData, date: formattedDate });
    }
    setHolidays(updatedHolidays);

    // Prepare data for Google Sheet - F, G, H columns
    const rowData = [
      "",
      "",
      "",
      "",
      "", // Empty columns A-E
      formattedDate, // Column F - Date
      formData.day, // Column G - Day
      formData.name, // Column H - Holiday Reason
    ];
    const action = "update";

    // find first empty row starting from row 2
    let rowIndex = "";
    if (editIndex !== null) {
      rowIndex = editIndex + 2;
    } else {
      rowIndex = holidays.length + 2;
    }

    try {
      setLoading(true);
      const response = await fetch(
        "https://script.google.com/macros/s/AKfycbyaBCq6ZKHhOZBXRp9qw3hqrXh_aIOPvIHh_G41KtzPovhjl-UjEgj75Ok6gwJhrPOX/exec",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            action: action,
            sheetName: "Working Day Calendar",
            rowIndex: rowIndex,
            rowData: JSON.stringify(rowData),
          }),
        },
      );

      const result = await response.json();
      if (result.success) {
        console.log("✅ Successfully saved to Google Sheet:", result);
        alert(
          action === "update"
            ? "Holiday updated successfully!"
            : "Holiday added successfully!",
        );

        // Refresh from sheet to get updated data
        await fetchHolidaysFromSheet();
      } else {
        console.error("❌ Sheet submission failed:", result.error);
        alert(
          "Failed to save to Google Sheet: " + (result.message || result.error),
        );
      }
    } catch (err) {
      console.error("❌ Network error:", err);
      alert("Network error! Please check your connection.");
    } finally {
      setLoading(false);
    }

    // Reset form
    setFormData({ day: "", date: "", name: "" });
    setEditIndex(null);
    setModalOpen(false);
  };

  const handleEdit = (index) => {
    const holiday = holidays[index];
    // Convert DD-MM-YYYY to YYYY-MM-DD for date input
    const [day, month, year] = holiday.date.split("-");
    const formattedDateForInput = `${year}-${month}-${day}`;

    setEditIndex(index);
    setFormData({
      ...holiday,
      date: formattedDateForInput,
    });
    setModalOpen(true);
  };

  const handleDelete = async (index) => {
    if (!window.confirm("Are you sure you want to delete this holiday?")) {
      return;
    }

    // Calculate the row number in the sheet (Row 2 + index)
    const rowNumberInSheet = 2 + index;

    try {
      setLoading(true);

      // Use the existing "update" action to clear the holiday data
      const response = await fetch(
        "https://script.google.com/macros/s/AKfycbyaBCq6ZKHhOZBXRp9qw3hqrXh_aIOPvIHh_G41KtzPovhjl-UjEgj75Ok6gwJhrPOX/exec",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            action: "update",
            sheetName: "Working Day Calendar",
            rowIndex: rowNumberInSheet,
            rowData: JSON.stringify(["", "", "", "", "", "", "", ""]), // Clear columns A-H
          }),
        },
      );

      const result = await response.json();
      if (result.success) {
        console.log("✅ Holiday row cleared in Google Sheet");

        // Update UI after successful deletion
        const updatedHolidays = holidays.filter((_, i) => i !== index);
        setHolidays(updatedHolidays);
        localStorage.setItem("holidays", JSON.stringify(updatedHolidays));

        alert("Holiday deleted successfully!");
      } else {
        console.error("❌ Sheet deletion failed:", result.error);
        alert("Failed to delete from Google Sheet. Please try again.");
      }
    } catch (err) {
      console.error("❌ Network error:", err);
      alert("Network error! Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const exportToSheet = () => {
    const header = ["Date", "Day", "Holiday Name"];
    const rows = holidays.map((h) => [h.date, h.day, h.name]);

    const csvContent = [header, ...rows].map((row) => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "Holidays.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  const refreshFromSheet = async () => {
    await fetchHolidaysFromSheet();
    alert("Holidays refreshed from Google Sheet!");
  };

  return (
    <AdminLayout>
      <div className="holiday-container">
        <div className="holiday-header">
          <h1>🎉 Holiday List</h1>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            {loading && <span style={{ color: "#666" }}>Loading...</span>}
            <button
              className="add-button"
              onClick={() => setModalOpen(true)}
              disabled={loading}
            >
              + Add Holiday
            </button>
            <button
              className="add-button"
              onClick={exportToSheet}
              disabled={loading}
            >
              <Download size={16} /> Export CSV
            </button>
            <button
              className="add-button"
              onClick={refreshFromSheet}
              disabled={loading}
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        <div className="holiday-card">
          {loading ? (
            <div style={{ textAlign: "center", padding: "50px" }}>
              <p>Loading holidays...</p>
            </div>
          ) : (
            <table className="holiday-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Day</th>
                  <th>Date</th>
                  <th>Holiday Name</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {holidays.map((h, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{h.day}</td>
                    <td>{h.date}</td>
                    <td>{h.name}</td>
                    <td>
                      <div className="action-row">
                        <Pencil
                          size={16}
                          className="action-icon edit-icon"
                          onClick={() => handleEdit(i)}
                          title="Edit"
                        />
                        <Trash2
                          size={16}
                          className="action-icon delete-icon"
                          onClick={() => handleDelete(i)}
                          title="Delete"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {modalOpen && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h2>{editIndex !== null ? "Edit Holiday" : "Add Holiday"}</h2>
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="day">Day</label>
                  <select
                    id="day"
                    name="day"
                    value={formData.day}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select Day</option>
                    <option value="Monday">Monday</option>
                    <option value="Tuesday">Tuesday</option>
                    <option value="Wednesday">Wednesday</option>
                    <option value="Thursday">Thursday</option>
                    <option value="Friday">Friday</option>
                    <option value="Saturday">Saturday</option>
                    <option value="Sunday">Sunday</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="date">Date</label>
                  <input
                    type="date"
                    id="date"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="name">Holiday Reason</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    placeholder="e.g., New Year, Christmas, Diwali"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="modal-actions">
                  <button
                    type="submit"
                    className="save-button"
                    disabled={loading}
                  >
                    {loading
                      ? "Saving..."
                      : editIndex !== null
                        ? "Update"
                        : "Save"}
                  </button>
                  <button
                    type="button"
                    className="cancel-button"
                    onClick={() => {
                      setFormData({ day: "", date: "", name: "" });
                      setEditIndex(null);
                      setModalOpen(false);
                    }}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default Holiday;
