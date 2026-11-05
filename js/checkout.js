window.CheckoutManager = {
    ordersStorageKey: "kiwi-orders",
    phonePattern: /^(03|05|07|08|09)\d{8}$/,
    emailPattern: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
    initialized: false,

    initialize() {
        if (this.initialized) {
            return;
        }

        const form = document.getElementById("checkout-form");
        const startButton = document.getElementById("checkout-start");
        const cancelButton = document.getElementById("checkout-cancel");
        if (!form || !startButton || !cancelButton) {
            throw new Error("Không tìm thấy các thành phần biểu mẫu thanh toán.");
        }

        startButton.addEventListener("click", () => this.showForm());
        cancelButton.addEventListener("click", () => this.hideForm());
        form.addEventListener("submit", event => this.handleSubmit(event));

        [
            ["checkout-name", value => value.trim().length > 0, "Vui lòng nhập họ và tên."],
            ["checkout-phone", value => this.phonePattern.test(value.trim()), "Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 03, 05, 07, 08 hoặc 09."],
            ["checkout-email", value => this.emailPattern.test(value.trim()), "Vui lòng nhập địa chỉ email hợp lệ."],
            ["checkout-address", value => value.trim().length > 0, "Vui lòng nhập địa chỉ giao hàng."]
        ].forEach(([id, validator, message]) => {
            const input = document.getElementById(id);
            input.addEventListener("input", () => this.validateField(input, validator, message));
            input.addEventListener("blur", () => this.validateField(input, validator, message));
        });

        this.initialized = true;
        this.updateButtonState();
    },

    updateButtonState() {
        const button = document.getElementById("checkout-start");
        if (button) {
            button.disabled = !window.CartManager || window.CartManager.getItemCount() === 0;
        }
    },

    validateField(input, validator, message) {
        const value = input.value;
        const valid = validator(value);
        input.setCustomValidity(valid ? "" : message);
        input.setAttribute("aria-invalid", String(!valid));
        const error = document.getElementById(`${input.id}-error`);
        error.textContent = valid || value.length === 0 ? "" : message;
        return valid;
    },

    validateForm() {
        const checks = [
            ["checkout-name", value => value.trim().length > 0, "Vui lòng nhập họ và tên."],
            ["checkout-phone", value => this.phonePattern.test(value.trim()), "Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 03, 05, 07, 08 hoặc 09."],
            ["checkout-email", value => this.emailPattern.test(value.trim()), "Vui lòng nhập địa chỉ email hợp lệ."],
            ["checkout-address", value => value.trim().length > 0, "Vui lòng nhập địa chỉ giao hàng."]
        ];
        let valid = true;
        checks.forEach(([id, validator, message]) => {
            if (!this.validateField(document.getElementById(id), validator, message)) {
                valid = false;
            }
        });
        return valid;
    },

    readOrders() {
        const serialized = localStorage.getItem(this.ordersStorageKey);
        if (serialized === null) {
            return [];
        }

        const orders = JSON.parse(serialized);
        if (!Array.isArray(orders)) {
            throw new Error("Danh sách đơn hàng đã lưu không đúng định dạng.");
        }
        return orders;
    },

    handleSubmit(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const message = document.getElementById("checkout-message");
        message.classList.remove("is-error");

        try {
            if (!this.validateForm() || !form.reportValidity()) {
                return;
            }

            if (CartManager.getItemCount() === 0) {
                throw new Error("Giỏ hàng đang trống.");
            }

            const formData = new FormData(form);
            const orders = this.readOrders();
            const order = {
                id: `ORD-${Date.now()}`,
                createdAt: new Date().toISOString(),
                customer: {
                    name: String(formData.get("name")).trim(),
                    phone: String(formData.get("phone")).trim(),
                    email: String(formData.get("email")).trim(),
                    address: String(formData.get("address")).trim()
                },
                items: CartManager.items.map(item => ({
                    productId: item.productId,
                    title: item.title,
                    variant: item.variant,
                    quantity: item.quantity,
                    unitPrice: item.price
                })),
                total: CartManager.getTotal(),
                status: "confirmed"
            };

            orders.push(order);
            localStorage.setItem(this.ordersStorageKey, JSON.stringify(orders));
            CartManager.items = [];
            CartManager.save();
            form.reset();
            form.hidden = true;
            document.getElementById("checkout-start").hidden = false;
            message.textContent = `Thanh toán thành công! Mã đơn hàng: ${order.id}`;
            this.updateButtonState();
        } catch (error) {
            console.error("Không thể lưu đơn hàng:", error);
            message.classList.add("is-error");
            message.textContent = "Không thể hoàn tất thanh toán. Vui lòng kiểm tra dữ liệu và thử lại.";
        }
    },

    showForm() {
        if (CartManager.getItemCount() === 0) {
            return;
        }
        document.getElementById("checkout-message").textContent = "";
        document.getElementById("checkout-form").hidden = false;
        document.getElementById("checkout-start").hidden = true;
        document.getElementById("checkout-name").focus();
    },

    hideForm() {
        document.getElementById("checkout-form").hidden = true;
        document.getElementById("checkout-start").hidden = false;
        document.getElementById("checkout-message").textContent = "";
    }
};
