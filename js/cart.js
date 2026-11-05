window.CartManager = {
    storageKey: "kiwi-cart",
    items: [],
    initialized: false,

    initialize() {
        if (this.initialized) {
            return;
        }

        const toggle = document.getElementById("cart-toggle");
        const miniCart = document.getElementById("mini-cart");
        const closeButton = document.querySelector(".mini-cart-close");
        if (!toggle || !miniCart || !closeButton) {
            throw new Error("Không tìm thấy nút giỏ hàng hoặc mini-cart.");
        }

        this.items = this.readItems();
        toggle.addEventListener("click", () => this.toggle());
        closeButton.addEventListener("click", () => this.close());
        miniCart.addEventListener("click", event => this.handleMiniCartClick(event));
        document.addEventListener("keydown", event => {
            if (event.key === "Escape" && !miniCart.hidden) {
                this.close();
            }
        });
        this.initialized = true;
        this.refreshProducts();
        this.render();
    },

    readItems() {
        const serialized = localStorage.getItem(this.storageKey);
        if (serialized === null) {
            return [];
        }

        const items = JSON.parse(serialized);
        if (!Array.isArray(items)) {
            throw new Error("Dữ liệu giỏ hàng đã lưu không đúng định dạng.");
        }

        return items.map(item => {
            if (
                !item ||
                typeof item.productId !== "string" ||
                typeof item.variant !== "string" ||
                !Number.isInteger(item.quantity) ||
                item.quantity < 1
            ) {
                throw new Error("Một mặt hàng trong giỏ hàng đã lưu không hợp lệ.");
            }

            const product = window.ProductCatalog?.getById(item.productId);
            return {
                productId: item.productId,
                variant: item.variant,
                quantity: item.quantity,
                title: typeof item.title === "string" ? item.title : product?.title || "",
                image: typeof item.image === "string" ? item.image : product?.image || "",
                price: Number.isFinite(item.price) ? item.price : product?.price ?? null
            };
        });
    },

    save() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.items));
        this.render();
    },

    addItem(product, variant) {
        if (!this.initialized) {
            throw new Error("CartManager chưa được khởi tạo.");
        }
        if (!product || typeof product.id !== "string" || typeof variant !== "string" || !variant) {
            throw new Error("Sản phẩm hoặc biến thể không hợp lệ.");
        }

        const item = this.items.find(entry =>
            entry.productId === product.id && entry.variant === variant
        );
        if (item) {
            if (item.quantity >= product.stock) {
                return {
                    added: false,
                    message: `Sản phẩm "${product.title}" đã đạt giới hạn tồn kho.`
                };
            }
            item.quantity += 1;
            item.title = product.title;
            item.image = product.image;
            item.price = product.price;
        } else {
            if (product.stock < 1) {
                return {
                    added: false,
                    message: `Sản phẩm "${product.title}" hiện đã hết hàng.`
                };
            }
            this.items.push({
                productId: product.id,
                variant,
                quantity: 1,
                title: product.title,
                image: product.image,
                price: product.price
            });
        }

        this.save();
        return {
            added: true,
            message: `Đã thêm "${product.title}" (${variant}) vào giỏ hàng.`
        };
    },

    getItemCount() {
        return this.items.reduce((total, item) => total + item.quantity, 0);
    },

    getTotal() {
        return Number(this.items.reduce((total, item) => {
            const price = Number.isFinite(item.price) ? item.price : 0;
            return total + price * item.quantity;
        }, 0).toFixed(2));
    },

    formatPrice(value) {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD"
        }).format(value);
    },

    refreshProducts() {
        if (!window.ProductCatalog) {
            return;
        }
        this.items = this.items.map(item => {
            const product = window.ProductCatalog.getById(item.productId);
            return product
                ? {
                    ...item,
                    title: product.title,
                    image: product.image,
                    price: product.price
                }
                : item;
        });
        if (this.initialized) {
            this.save();
        }
    },

    render() {
        const toggle = document.getElementById("cart-toggle");
        const count = document.querySelector(".cart-count");
        const body = document.getElementById("mini-cart-items");
        const total = document.getElementById("mini-cart-total");
        if (!toggle || !count || !body || !total) {
            return;
        }

        const itemCount = this.getItemCount();
        count.textContent = String(itemCount);
        toggle.setAttribute("aria-label", `Giỏ hàng, ${itemCount} sản phẩm`);

        const fragment = document.createDocumentFragment();
        if (this.items.length === 0) {
            const row = document.createElement("tr");
            row.className = "mini-cart-empty-row";
            const cell = document.createElement("td");
            cell.colSpan = 5;
            cell.textContent = "Giỏ hàng của bạn đang trống.";
            row.appendChild(cell);
            fragment.appendChild(row);
        } else {
            this.items.forEach(item => fragment.appendChild(this.createRow(item)));
        }
        body.replaceChildren(fragment);
        total.textContent = this.formatPrice(this.getTotal());
        window.CheckoutManager?.updateButtonState();
    },

    createRow(item) {
        const row = document.createElement("tr");
        const productCell = document.createElement("td");
        productCell.className = "mini-cart-product";
        const productName = document.createElement("span");
        productName.className = "mini-cart-product-name";
        productName.textContent = item.title || `Sản phẩm #${item.productId}`;
        const variant = document.createElement("small");
        variant.textContent = item.variant;
        productCell.append(productName, variant);

        const unitPrice = Number.isFinite(item.price) ? item.price : 0;
        const priceCell = this.createCell(this.formatPrice(unitPrice));
        const quantityCell = document.createElement("td");
        quantityCell.className = "mini-cart-quantity";
        quantityCell.append(
            this.createActionButton("−", "decrease", item, "Giảm số lượng"),
            document.createTextNode(` ${item.quantity} `),
            this.createActionButton("+", "increase", item, "Tăng số lượng")
        );
        const subtotalCell = this.createCell(this.formatPrice(unitPrice * item.quantity));
        const removeCell = document.createElement("td");
        removeCell.appendChild(this.createActionButton("Xóa", "remove", item, "Xóa sản phẩm"));

        row.append(productCell, priceCell, quantityCell, subtotalCell, removeCell);
        return row;
    },

    createCell(text) {
        const cell = document.createElement("td");
        cell.textContent = text;
        return cell;
    },

    createActionButton(label, action, item, accessibleLabel) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `mini-cart-action mini-cart-action-${action}`;
        button.dataset.action = action;
        button.dataset.productId = item.productId;
        button.dataset.variant = item.variant;
        button.setAttribute("aria-label", `${accessibleLabel}: ${item.title || item.productId} (${item.variant})`);
        button.textContent = label;
        return button;
    },

    handleMiniCartClick(event) {
        if (!(event.target instanceof Element)) {
            return;
        }
        const button = event.target.closest("button[data-action][data-product-id][data-variant]");
        if (!button || !event.currentTarget.contains(button)) {
            return;
        }

        const item = this.items.find(entry =>
            entry.productId === button.dataset.productId &&
            entry.variant === button.dataset.variant
        );
        if (!item) {
            throw new Error("Không tìm thấy mặt hàng trong giỏ hàng.");
        }

        if (button.dataset.action === "remove" || (button.dataset.action === "decrease" && item.quantity === 1)) {
            this.items = this.items.filter(entry => entry !== item);
        } else if (button.dataset.action === "decrease") {
            item.quantity -= 1;
        } else if (button.dataset.action === "increase") {
            const product = window.ProductCatalog.getById(item.productId);
            if (product && item.quantity >= product.stock) {
                document.getElementById("catalog-status").textContent =
                    `Sản phẩm "${product.title}" đã đạt giới hạn tồn kho.`;
                return;
            }
            item.quantity += 1;
        }

        this.save();
    },

    toggle() {
        const toggle = document.getElementById("cart-toggle");
        const panel = document.getElementById("mini-cart");
        const shouldOpen = panel.hidden;
        panel.hidden = !shouldOpen;
        toggle.setAttribute("aria-expanded", String(shouldOpen));
    },

    close() {
        const toggle = document.getElementById("cart-toggle");
        const panel = document.getElementById("mini-cart");
        panel.hidden = true;
        toggle.setAttribute("aria-expanded", "false");
    }
};
