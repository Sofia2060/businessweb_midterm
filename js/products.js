(() => {
    const productsById = new Map();
    let allProducts = [];
    let productContainer = null;
    let filtersInitialized = false;
    const categoryNames = {
        "men's clothing": "Thời trang nam",
        "women's clothing": "Thời trang nữ",
        jewelery: "Trang sức",
        electronics: "Điện tử"
    };

    function requiredText(productElement, tagName, productId) {
        const value = productElement.querySelector(tagName)?.textContent?.trim();
        if (!value) {
            throw new Error(`Sản phẩm ${productId} thiếu trường ${tagName}.`);
        }
        return value;
    }

    function parseProducts(xmlText) {
        const xml = new DOMParser().parseFromString(xmlText, "application/xml");
        if (xml.querySelector("parsererror")) {
            throw new Error("Không thể phân tích XML sản phẩm.");
        }

        const productElements = Array.from(xml.querySelectorAll("products > product"));
        if (productElements.length === 0) {
            throw new Error("Tệp XML không chứa sản phẩm.");
        }

        return productElements.map(productElement => {
            const id = requiredText(productElement, "id", "không xác định");
            const price = Number(requiredText(productElement, "price", id));
            const stock = Number(requiredText(productElement, "stock", id));
            const image = requiredText(productElement, "image", id);

            if (!Number.isFinite(price) || price < 0 || !Number.isInteger(stock) || stock < 0) {
                throw new Error(`Sản phẩm ${id} có giá hoặc tồn kho không hợp lệ.`);
            }

            return {
                id,
                title: requiredText(productElement, "title", id),
                price,
                description: requiredText(productElement, "description", id),
                category: requiredText(productElement, "category", id),
                image,
                color: requiredText(productElement, "color", id),
                stock
            };
        });
    }

    function appendTextElement(parent, tagName, className, text) {
        const element = document.createElement(tagName);
        element.className = className;
        element.textContent = text;
        parent.appendChild(element);
        return element;
    }

    function formatPrice(price) {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD"
        }).format(price);
    }

    function createActionButton(label, action, product) {
        const button = document.createElement("button");
        button.className = `product-action product-action-${action}`;
        button.type = "button";
        button.dataset.action = action;
        button.dataset.id = product.id;
        button.dataset.variant = product.color;
        button.textContent = label;
        return button;
    }

    function createProductCard(product) {
        const article = document.createElement("article");
        article.className = "product-card";
        article.dataset.id = product.id;
        article.dataset.variant = product.color;

        const imageArea = document.createElement("div");
        imageArea.className = "product-image-link";

        const image = document.createElement("img");
        image.src = product.image;
        image.alt = product.title;
        image.loading = "lazy";
        imageArea.appendChild(image);
        article.appendChild(imageArea);

        const info = document.createElement("div");
        info.className = "product-info";
        appendTextElement(
            info,
            "p",
            "product-category",
            categoryNames[product.category] || product.category
        );
        appendTextElement(info, "h3", "product-title", product.title);
        appendTextElement(info, "p", "product-variant", `Màu sắc: ${product.color}`);
        appendTextElement(info, "p", "product-price", formatPrice(product.price));
        appendTextElement(info, "p", "product-stock", `Còn ${product.stock} sản phẩm`);

        const actions = document.createElement("div");
        actions.className = "product-actions";
        actions.append(
            createActionButton("Thêm vào giỏ hàng", "add-to-cart", product),
            createActionButton("Xem nhanh", "quick-view", product),
            createActionButton("Rating Detail", "rating-detail", product)
        );
        info.appendChild(actions);
        article.appendChild(info);

        return article;
    }

    function renderProducts(container, products) {
        productsById.clear();
        products.forEach(product => {
            if (productsById.has(product.id)) {
                throw new Error(`ID sản phẩm ${product.id} bị trùng trong XML.`);
            }
            productsById.set(product.id, product);
        });

        allProducts = products;
        productContainer = container;
        initializeFilters();
        container.setAttribute("aria-busy", "false");
        document.querySelector(".catalog").classList.add("is-loaded");
        applyFilter();
        window.CartManager?.refreshProducts();
    }

    function initializeFilters() {
        if (filtersInitialized) {
            return;
        }
        const form = document.getElementById("product-filter-form");
        const priceInput = document.getElementById("price");
        const priceValue = document.getElementById("price-value");
        if (!form || !priceInput || !priceValue) {
            throw new Error("Không tìm thấy các thành phần của bộ lọc sản phẩm.");
        }

        const updatePriceValue = () => {
            priceValue.value = formatPrice(Number(priceInput.value));
            priceValue.textContent = priceValue.value;
        };
        form.addEventListener("submit", event => {
            event.preventDefault();
            applyFilter();
        });
        form.addEventListener("input", event => {
            if (event.target === priceInput) {
                updatePriceValue();
            }
            applyFilter();
        });
        form.addEventListener("change", applyFilter);
        form.addEventListener("reset", () => {
            window.setTimeout(() => {
                updatePriceValue();
                applyFilter();
            }, 0);
        });
        updatePriceValue();
        filtersInitialized = true;
    }

    function applyFilter() {
        if (!productContainer || allProducts.length === 0) {
            return;
        }

        const selectedCategory = document.getElementById("category").value;
        const selectedMaxPrice = Number(document.getElementById("price").value);
        const selectedColor = document.querySelector('input[name="color"]:checked')?.value || "all";
        const selectedMinRating = Number(document.getElementById("rating").value);

        const filteredProducts = allProducts.filter(product => {
            const productRating = product.rating ?? window.ReviewCatalog?.getAverage(product.id) ?? 0;
            const matchCategory = selectedCategory === "all" || product.category === selectedCategory;
            const matchPrice = product.price <= selectedMaxPrice;
            const matchColor = selectedColor === "all" || product.color === selectedColor;
            const matchRating = productRating >= selectedMinRating;
            return matchCategory && matchPrice && matchColor && matchRating;
        });

        const fragment = document.createDocumentFragment();
        filteredProducts.forEach(product => fragment.appendChild(createProductCard(product)));
        productContainer.replaceChildren(fragment);
        productContainer.setAttribute("aria-busy", "false");
        document.getElementById("product-count").textContent = String(filteredProducts.length);
        document.getElementById("empty-products").hidden = filteredProducts.length > 0;
        window.ReviewCatalog?.decorateProducts();
    }

    function showLoadError(container, error) {
        container.replaceChildren();
        container.setAttribute("aria-busy", "false");
        document.getElementById("product-count").textContent = "0";
        document.querySelector(".catalog").classList.add("is-loaded");
        const status = document.getElementById("catalog-status");
        status.classList.add("is-error");
        status.textContent = "Không thể tải danh sách sản phẩm. Hãy chạy trang qua Live Server hoặc máy chủ web.";
        console.error("Không thể tải danh sách sản phẩm:", error);
    }

    async function load(container) {
        try {
            const response = await fetch(new URL("data/products.xml", document.baseURI));
            if (!response.ok) {
                throw new Error(`Tải XML thất bại với HTTP ${response.status}.`);
            }
            renderProducts(container, parseProducts(await response.text()));
        } catch (error) {
            showLoadError(container, error);
        }
    }

    window.ProductCatalog = {
        applyFilter,
        formatPrice,
        getById: id => productsById.get(id),
        load
    };
})();
