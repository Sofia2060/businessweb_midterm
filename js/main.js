(() => {
    function setStatus(message, isError = false) {
        const status = document.getElementById("catalog-status");
        status.textContent = message;
        status.classList.toggle("is-error", isError);
    }

    function addToCart(product, variant) {
        const result = CartManager.addItem(product, variant);
        setStatus(result.message, !result.added);
    }

    function showQuickView(product, variant) {
        document.getElementById("quick-view-image").src = product.image;
        document.getElementById("quick-view-image").alt = product.title;
        document.getElementById("quick-view-category").textContent = product.category;
        document.getElementById("quick-view-title").textContent = product.title;
        document.getElementById("quick-view-description").textContent = product.description;
        document.getElementById("quick-view-variant").textContent = `Màu sắc: ${variant}`;
        document.getElementById("quick-view-price").textContent = ProductCatalog.formatPrice(product.price);

        const dialog = document.getElementById("quick-view-dialog");
        if (!dialog.showModal) {
            throw new Error("Trình duyệt hiện tại không hỗ trợ hộp thoại xem nhanh.");
        }
        dialog.showModal();
    }

    function handleProductListClick(event) {
        if (!(event.target instanceof Element)) {
            return;
        }
        const button = event.target.closest("button[data-action][data-id][data-variant]");
        if (!button || !event.currentTarget.contains(button)) {
            return;
        }

        const product = ProductCatalog.getById(button.dataset.id);
        const variant = button.dataset.variant;
        if (!product || !variant) {
            setStatus("Không tìm thấy sản phẩm hoặc phiên bản được chọn.", true);
            return;
        }

        try {
            if (button.dataset.action === "add-to-cart") {
                addToCart(product, variant);
            } else if (button.dataset.action === "quick-view") {
                showQuickView(product, variant);
            } else if (button.dataset.action === "rating-detail") {
                ReviewCatalog.showDetails(product.id, product.title);
            }
        } catch (error) {
            console.error("Không thể xử lý thao tác sản phẩm:", error);
            setStatus("Không thể hoàn tất thao tác. Vui lòng kiểm tra bộ nhớ trình duyệt và thử lại.", true);
        }
    }

    function initialize() {
        const productList = document.getElementById("product-list");
        if (!productList) {
            throw new Error("Không tìm thấy container #product-list.");
        }

        productList.addEventListener("click", handleProductListClick);

        try {
            CartManager.initialize();
            CheckoutManager.initialize();
        } catch (error) {
            console.error("Không thể khởi tạo giỏ hàng hoặc thanh toán:", error);
            setStatus("Không thể khởi tạo giỏ hàng hoặc thanh toán. Vui lòng kiểm tra dữ liệu đã lưu trong trình duyệt.", true);
        }

        ProductCatalog.load(productList);
        ReviewCatalog.load();
    }

    document.addEventListener("DOMContentLoaded", initialize, { once: true });
})();
