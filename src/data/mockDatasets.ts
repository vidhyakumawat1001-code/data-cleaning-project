import { Dataset } from '../types';

export const mockDatasets: Dataset[] = [
  {
    name: "Customer Contacts (Messy)",
    columns: ["id", "name", "email", "phone", "country", "signup_date"],
    rows: [
      {
        id: "C101",
        name: "john doe",
        email: "john.doe@gmail.com",
        phone: "1234567890",
        country: "USA",
        signup_date: "2023-01-15"
      },
      {
        id: "C101", // Exact duplicate ID for deduplication
        name: "john doe",
        email: "john.doe@gmail.com",
        phone: "1234567890",
        country: "USA",
        signup_date: "2023-01-15"
      },
      {
        id: "C102",
        name: "  Jane Smith", // Padding spaces
        email: "jane.smith@example.com",
        phone: "123-456-7890", // Hyphenated format
        country: "usa", // Casing issue
        signup_date: "15/01/2023" // Different date format DD/MM/YYYY
      },
      {
        id: "C103",
        name: "jane smith", // Duplicate entry but lowercase name & diff phone
        email: "jane.smith@example.com",
        phone: "1234567890",
        country: "USA",
        signup_date: "2023/01/15" // Format with slashes
      },
      {
        id: "C104",
        name: "ROBERT MC'DONALD",
        email: "robert.mcd@corp.io",
        phone: "987 654 3210", // Spaced phone
        country: "UK",
        signup_date: "Jan 12, 2023" // Written date format
      },
      {
        id: "C105",
        name: "Alice  Green  ", // Interspersed and trailing space
        email: null, // Missing value
        phone: null, // Missing value
        country: "  UK  ", // Padded text
        signup_date: "1673827200" // Unix Timestamp (Jan 16 2023)
      },
      {
        id: "C106",
        name: "MARK SPENCER",
        email: "mark.spencer@mail.co.uk",
        phone: "+447911123456",
        country: "uk",
        signup_date: null // Missing signup date
      },
      {
        id: "C107",
        name: null, // Missing name
        email: "anonymous@user.net",
        phone: "555-0199",
        country: "United States", // Synonym for USA
        signup_date: "2023-01-18"
      }
    ]
  },
  {
    name: "Sales Transaction Log (Messy)",
    columns: ["transaction_id", "product_name", "category", "price", "sale_date", "customer_status"],
    rows: [
      {
        transaction_id: "T1001",
        product_name: "Wireless Mouse",
        category: "Accessories",
        price: "29.99",
        sale_date: "2024-05-10",
        customer_status: "active"
      },
      {
        transaction_id: "T1001", // Duplicate sales log
        product_name: "wireless mouse", // lowercase
        category: "ACC.", // Abbreviation and typo
        price: "29.99",
        sale_date: "10-05-2024", // Mixed date
        customer_status: "ACTIVE" // Mixed case status
      },
      {
        transaction_id: "T1002",
        product_name: "Mechanical Keyboard",
        category: "Hardware",
        price: "89.50",
        sale_date: "2024/05/11",
        customer_status: "active"
      },
      {
        transaction_id: "T1003",
        product_name: null, // Missing product
        category: "Accessories",
        price: "15.00",
        sale_date: "2024-05-12",
        customer_status: "inactive"
      },
      {
        transaction_id: "T1004",
        product_name: "Usb-C Cable",
        category: "Cables",
        price: null, // Missing price
        sale_date: "12/05/2024",
        customer_status: "  Inactive"
      },
      {
        transaction_id: "T1005",
        product_name: "USB-C Cable  ",
        category: "  cables", // lowercase and spaced category
        price: "12.00",
        sale_date: "2024-05-14",
        customer_status: null // Secret status
      },
      {
        transaction_id: "T1006",
        product_name: "FHD Monitor",
        category: null, // Missing category
        price: "199.00",
        sale_date: "2024-05-15 14:30:11", // Timestamp format
        customer_status: "pending"
      },
      {
        transaction_id: "T1007",
        product_name: "Ergonomic Office Chair",
        category: "Furniture",
        price: "-50.00", // Out Of bounds or error pricing
        sale_date: "2024-05-16",
        customer_status: "active"
      }
    ]
  },
  {
    name: "Sensor Telemetry Records (Messy)",
    columns: ["sensor_id", "timestamp", "temperature_c", "battery_percent", "status"],
    rows: [
      {
        sensor_id: "TEMP_S01",
        timestamp: "2025-06-01T12:00:00Z",
        temperature_c: "23.5",
        battery_percent: "98",
        status: "OK"
      },
      {
        sensor_id: "TEMP_S01", // Duplicate packet
        timestamp: "2025-06-01T12:00:00Z",
        temperature_c: "23.5",
        battery_percent: "98",
        status: "OK"
      },
      {
        sensor_id: "TEMP_S02",
        timestamp: "2025-06-01T12:05:00",
        temperature_c: "  24.1", // Padded value
        battery_percent: "87",
        status: "ok" // lowercase
      },
      {
        sensor_id: "TEMP_S03",
        timestamp: "01-06-2025 12:10:00",
        temperature_c: "-999.0", // Faulty missing-value anchor
        battery_percent: null, // Missing battery info
        status: "FAULT"
      },
      {
        sensor_id: "TEMP_S04",
        timestamp: null, // Missing timestamp
        temperature_c: "22.8",
        battery_percent: "12",
        status: "  LOW_BAT  "
      },
      {
        sensor_id: "TEMP_S01",
        timestamp: "1748779500", // UNIX Epoch timestamp for June 1st 2025 12:05:00 UTC
        temperature_c: "23.8",
        battery_percent: "97",
        status: "OK"
      },
      {
        sensor_id: "TEMP_S02",
        timestamp: "2025-06-01T12:10:00Z",
        temperature_c: "24.2",
        battery_percent: "0", // Bad/Empty indicator
        status: "OFFLINE"
      }
    ]
  }
];
