(() => {
    const sessionStorageKey = "kiwi-admin-session";
    const localOrdersStorageKey = "kiwi-orders";
    const employeeDataUrl = new URL("data/employees.json", document.baseURI);
    const invoicesDataUrl = new URL("data/carts.xml", document.baseURI);
    const productsDataUrl = new URL("data/products.xml", document.baseURI);

    function showLoginError(message) {
        const errorElement = document.getElementById("admin-login-error");
        errorElement.textContent = message;
    }

    async function readEmployees() {
        const response = await fetch(employeeDataUrl);
        if (!response.ok) {
            throw new Error(`Tải danh sách nhân viên thất bại (HTTP ${response.status}).`);
        }

        const employees = await response.json();
        if (!Array.isArray(employees)) {
            throw new Error("Tệp nhân viên phải chứa một danh sách.");
        }
        return employees;
    }

    async function handleLogin(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        const username = String(formData.get("username") || "").trim();
        const password = String(formData.get("password") || "");
        if (!username || !password) {
            showLoginError("Vui lòng nhập tên đăng nhập và mật khẩu.");
            return;
        }

        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        showLoginError("");
        try {
            const employees = await readEmployees();
            const employee = employees.find(candidate =>
                candidate.username === username && candidate.password === password
            );

            if (!employee) {
                showLoginError("Tên đăng nhập hoặc mật khẩu không chính xác.");
                return;
            }
            if (employee.role !== "manager") {
                showLoginError("Tài khoản này chưa được cấp quyền quản trị.");
                return;
            }

            localStorage.setItem(sessionStorageKey, JSON.stringify({
                employeeId: employee.id,
                username: employee.username,
                name: employee.name,
                role: employee.role,
                signedInAt: new Date().toISOString()
            }));
            window.location.href = "admin.html";
        } catch (error) {
            console.error("Không thể xác thực tài khoản Admin:", error);
            showLoginError("Không thể tải dữ liệu tài khoản. Hãy mở trang qua máy chủ web và thử lại.");
        } finally {
            button.disabled = false;
        }
    }

    function readSession() {
        const serialized = localStorage.getItem(sessionStorageKey);
        if (!serialized) {
            return null;
        }

        const session = JSON.parse(serialized);
        if (
            !session ||
            typeof session.employeeId !== "string" ||
            typeof session.username !== "string" ||
            session.role !== "manager"
        ) {
            throw new Error("Phiên đăng nhập quản trị không hợp lệ.");
        }
        return session;
    }

    async function fetchText(url, label) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Tải ${label} thất bại (HTTP ${response.status}).`);
        }
        return response.text();
    }

    function requiredXmlText(element, selector, context) {
        const value = element.querySelector(selector)?.textContent?.trim();
        if (!value) {
            throw new Error(`${context} thiếu trường ${selector}.`);
        }
        return value;
    }

    function parseInvoices(xmlText, productsById) {
        const xml = new DOMParser().parseFromString(xmlText, "application/xml");
        if (xml.querySelector("parsererror")) {
            throw new Error("Không thể phân tích tệp hóa đơn XML.");
        }

        return Array.from(xml.querySelectorAll("carts > invoice")).map(invoice => {
            const id = requiredXmlText(invoice, "invoice_id", "Hóa đơn");
            const items = Array.from(invoice.querySelectorAll("items > item")).map(item => {
                const productId = requiredXmlText(item, "product_id", id);
                const quantity = Number(requiredXmlText(item, "quantity", id));
                const unitPrice = Number(requiredXmlText(item, "unit_price", id));
                if (!Number.isInteger(quantity) || quantity < 1 || !Number.isFinite(unitPrice) || unitPrice < 0) {
                    throw new Error(`Hóa đơn ${id} có số lượng hoặc đơn giá không hợp lệ.`);
                }
                return {
                    productId,
                    title: productsById.get(productId) || `Sản phẩm #${productId}`,
                    quantity,
                    unitPrice
                };
            });

            return {
                id,
                createdAt: requiredXmlText(invoice, "created_at", id),
                customerName: requiredXmlText(invoice, "customer_id", id),
                employeeId: requiredXmlText(invoice, "employee_id", id),
                items,
                source: "Dữ liệu mẫu"
            };
        }).map(order => ({
            ...order,
            total: order.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
        }));
    }

    function parseProducts(xmlText) {
        const xml = new DOMParser().parseFromString(xmlText, "application/xml");
        if (xml.querySelector("parsererror")) {
            throw new Error("Không thể phân tích tệp sản phẩm XML.");
        }
        return new Map(Array.from(xml.querySelectorAll("products > product")).map(product => [
            requiredXmlText(product, "id", "Sản phẩm"),
            requiredXmlText(product, "title", "Sản phẩm")
        ]));
    }

    function readLocalOrders() {
        const serialized = localStorage.getItem(localOrdersStorageKey);
        if (serialized === null) {
            return [];
        }

        const orders = JSON.parse(serialized);
        if (!Array.isArray(orders)) {
            throw new Error("Danh sách đơn hàng trong localStorage không đúng định dạng.");
        }
        return orders.map(order => {
            if (!order || typeof order.id !== "string" || !Array.isArray(order.items)) {
                throw new Error("Một đơn hàng trong localStorage không hợp lệ.");
            }
            const items = order.items.map(item => {
                const quantity = Number(item.quantity);
                const unitPrice = Number(item.unitPrice);
                if (!Number.isInteger(quantity) || quantity < 1 || !Number.isFinite(unitPrice) || unitPrice < 0) {
                    throw new Error(`Đơn hàng ${order.id} có chi tiết sản phẩm không hợp lệ.`);
                }
                return {
                    productId: String(item.productId),
                    title: String(item.title || `Sản phẩm #${item.productId}`),
                    variant: String(item.variant || ""),
                    quantity,
                    unitPrice
                };
            });
            return {
                id: order.id,
                createdAt: String(order.createdAt || ""),
                customerName: String(order.customer?.name || "Khách hàng"),
                employeeId: "—",
                items,
                total: items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
                source: "Đặt hàng trực tuyến"
            };
        });
    }

    function formatPrice(value) {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD"
        }).format(value);
    }

    function formatDate(value) {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("vi-VN").format(date);
    }

    function createCell(text, className = "") {
        const cell = document.createElement("td");
        cell.textContent = text;
        if (className) {
            cell.className = className;
        }
        return cell;
    }

    function createOrderRow(order) {
        const row = document.createElement("tr");
        const details = order.items.map(item => {
            const variant = item.variant ? ` (${item.variant})` : "";
            return `${item.title}${variant} × ${item.quantity}`;
        }).join("; ");
        const quantity = order.items.reduce((sum, item) => sum + item.quantity, 0);

        row.append(
            createCell(order.id, "admin-order-id"),
            createCell(formatDate(order.createdAt)),
            createCell(order.customerName),
            createCell(order.employeeId),
            createCell(details || "Không có chi tiết sản phẩm", "admin-order-details"),
            createCell(String(quantity)),
            createCell(formatPrice(order.total), "admin-order-total")
        );
        row.title = order.source;
        return row;
    }

    function renderOrders(orders) {
        const body = document.getElementById("admin-orders-body");
        const fragment = document.createDocumentFragment();
        const unitsSold = orders.reduce((total, order) =>
            total + order.items.reduce((orderTotal, item) => orderTotal + item.quantity, 0), 0
        );
        const revenue = orders.reduce((total, order) => total + order.total, 0);

        if (orders.length === 0) {
            const row = document.createElement("tr");
            const cell = createCell("Hiện chưa có đơn hàng.", "admin-empty-cell");
            cell.colSpan = 7;
            row.appendChild(cell);
            fragment.appendChild(row);
        } else {
            orders
                .slice()
                .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
                .forEach(order => fragment.appendChild(createOrderRow(order)));
        }

        body.replaceChildren(fragment);
        document.getElementById("admin-order-count").textContent = String(orders.length);
        document.getElementById("admin-units-sold").textContent = String(unitsSold);
        document.getElementById("admin-revenue").textContent = formatPrice(revenue);
    }

    async function loadDashboard() {
        const status = document.getElementById("admin-data-status");
        status.classList.remove("is-error");
        status.textContent = "Đang tải dữ liệu đơn hàng…";

        try {
            const [invoicesXml, productsXml] = await Promise.all([
                fetchText(invoicesDataUrl, "hóa đơn mẫu"),
                fetchText(productsDataUrl, "danh sách sản phẩm")
            ]);
            readSession();
            const productsById = parseProducts(productsXml);
            const invoices = parseInvoices(invoicesXml, productsById);
            const localOrders = readLocalOrders();
            const orders = [...invoices, ...localOrders];
            renderOrders(orders);
            status.textContent = `Đang hiển thị ${invoices.length} hóa đơn mẫu và ${localOrders.length} đơn hàng từ cửa hàng.`;
        } catch (error) {
            console.error("Không thể tải dữ liệu bảng quản trị:", error);
            status.classList.add("is-error");
            status.textContent = "Không thể tải dữ liệu đơn hàng. Hãy kiểm tra các tệp dữ liệu và tải lại trang.";
            document.getElementById("admin-orders-body").replaceChildren();
        }
    }

    function initializeLogin() {
        const form = document.getElementById("admin-login-form");
        form.addEventListener("submit", handleLogin);
    }

    function initializeDashboard() {
        let session;
        try {
            session = readSession();
        } catch (error) {
            console.error("Phiên quản trị không hợp lệ:", error);
            localStorage.removeItem(sessionStorageKey);
        }

        if (!session) {
            window.location.replace("login.html");
            return;
        }

        document.getElementById("admin-user").textContent = `${session.name} · ${session.employeeId}`;
        document.getElementById("admin-logout").addEventListener("click", () => {
            localStorage.removeItem(sessionStorageKey);
            window.location.replace("login.html");
        });
        document.getElementById("admin-refresh").addEventListener("click", loadDashboard);
        loadDashboard();
    }

    document.addEventListener("DOMContentLoaded", () => {
        if (document.body.dataset.page === "login") {
            initializeLogin();
        } else if (document.body.dataset.page === "admin") {
            initializeDashboard();
        }
    }, { once: true });
})();
