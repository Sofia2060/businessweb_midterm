(() => {
    const reviewsByProductId = new Map();
    const averagesByProductId = new Map();
    const formatter = new Intl.NumberFormat("vi-VN", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
    });

    function requiredText(reviewElement, tagName, index) {
        const value = reviewElement.querySelector(tagName)?.textContent?.trim();
        if (!value) {
            throw new Error(`Đánh giá thứ ${index} thiếu trường ${tagName}.`);
        }
        return value;
    }

    function parseReviews(xmlText) {
        const xml = new DOMParser().parseFromString(xmlText, "application/xml");
        if (xml.querySelector("parsererror")) {
            throw new Error("Không thể phân tích XML đánh giá.");
        }

        const reviewElements = Array.from(xml.querySelectorAll("reviews > review"));
        if (reviewElements.length === 0) {
            throw new Error("Tệp XML không chứa đánh giá nào.");
        }

        return reviewElements.map((reviewElement, index) => {
            const productId = requiredText(reviewElement, "product_id", index + 1);
            const rating = Number(requiredText(reviewElement, "rating", index + 1));
            if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
                throw new Error(`Đánh giá thứ ${index + 1} có số sao không hợp lệ.`);
            }

            return {
                productId,
                customerName: requiredText(reviewElement, "customer_name", index + 1),
                rating,
                comment: requiredText(reviewElement, "comment", index + 1)
            };
        });
    }

    function groupReviews(reviews) {
        reviewsByProductId.clear();
        averagesByProductId.clear();

        reviews.forEach(review => {
            const productReviews = reviewsByProductId.get(review.productId) || [];
            productReviews.push(review);
            reviewsByProductId.set(review.productId, productReviews);
        });

        reviewsByProductId.forEach((productReviews, productId) => {
            const total = productReviews.reduce((sum, review) => sum + review.rating, 0);
            averagesByProductId.set(productId, total / productReviews.length);
        });
    }

    function createRatingBadge(productId, average) {
        const badge = document.createElement("span");
        const roundedRating = Math.round(average);
        badge.className = "review-rating-badge";
        badge.setAttribute("role", "img");
        badge.setAttribute("aria-label", `Đánh giá trung bình ${formatter.format(average)} trên 5 sao`);

        const stars = document.createElement("span");
        stars.className = "review-rating-stars";
        stars.setAttribute("aria-hidden", "true");
        stars.textContent = `${"★".repeat(roundedRating)}${"☆".repeat(5 - roundedRating)}`;

        const score = document.createElement("span");
        score.textContent = formatter.format(average);

        badge.append(stars, score);
        badge.dataset.productId = productId;
        return badge;
    }

    function decorateProducts() {
        document.querySelectorAll("#product-list .product-card[data-id]").forEach(card => {
            const productId = card.dataset.id;
            const imageArea = card.querySelector(".product-image-link");
            if (!imageArea) {
                return;
            }

            imageArea.querySelector(".review-rating-badge")?.remove();
            const average = averagesByProductId.get(productId);
            if (average !== undefined) {
                imageArea.appendChild(createRatingBadge(productId, average));
            }
        });
    }

    function createReviewItem(review) {
        const item = document.createElement("li");
        item.className = "review-detail-item";

        const heading = document.createElement("div");
        heading.className = "review-detail-heading";

        const customer = document.createElement("strong");
        customer.textContent = review.customerName;
        heading.appendChild(customer);

        const rating = document.createElement("span");
        rating.className = "review-detail-rating";
        rating.textContent = `${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)} (${review.rating}/5)`;
        rating.setAttribute("aria-label", `${review.rating} trên 5 sao`);
        heading.appendChild(rating);

        const comment = document.createElement("p");
        comment.textContent = review.comment;

        item.append(heading, comment);
        return item;
    }

    function showDetails(productId, productName) {
        const reviews = reviewsByProductId.get(productId) || [];
        const dialog = document.getElementById("rating-detail-dialog");
        const title = document.getElementById("rating-detail-title");
        const summary = document.getElementById("rating-detail-summary");
        const list = document.getElementById("rating-detail-list");

        title.textContent = `Đánh giá: ${productName}`;
        list.replaceChildren();

        const average = averagesByProductId.get(productId);
        if (reviews.length === 0 || average === undefined) {
            summary.textContent = "Sản phẩm chưa có đánh giá.";
        } else {
            summary.textContent = `${formatter.format(average)} / 5 sao · ${reviews.length} đánh giá`;
            const fragment = document.createDocumentFragment();
            reviews.forEach(review => fragment.appendChild(createReviewItem(review)));
            list.appendChild(fragment);
        }

        if (!dialog.showModal) {
            throw new Error("Trình duyệt hiện tại không hỗ trợ hộp thoại đánh giá.");
        }
        dialog.showModal();
    }

    async function load() {
        try {
            const response = await fetch(new URL("data/reviews.xml", document.baseURI));
            if (!response.ok) {
                throw new Error(`Tải XML đánh giá thất bại với HTTP ${response.status}.`);
            }
            groupReviews(parseReviews(await response.text()));
            decorateProducts();
            window.ProductCatalog?.applyFilter();
        } catch (error) {
            document.getElementById("catalog-status").textContent =
                "Không thể tải dữ liệu đánh giá sản phẩm.";
            document.getElementById("catalog-status").classList.add("is-error");
            console.error("Không thể tải dữ liệu đánh giá:", error);
        }
    }

    window.ReviewCatalog = {
        decorateProducts,
        getAverage: productId => averagesByProductId.get(productId),
        load,
        showDetails
    };
})();
