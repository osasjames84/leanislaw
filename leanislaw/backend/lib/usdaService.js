const USDA_BASE_URL = "https://api.nal.usda.gov/fdc/v1";

function getApiKey() {
    const key = process.env.USDA_API_KEY;
    if (!key) {
        throw new Error("USDA_API_KEY is not set");
    }
    return key;
}

async function usdaFetch(path, options = {}) {
    const apiKey = getApiKey();
    const sep = path.includes("?") ? "&" : "?";
    const url = `${USDA_BASE_URL}${path}${sep}api_key=${encodeURIComponent(apiKey)}`;

    const res = await fetch(url, {
        method: options.method || "GET",
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
        body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        const msg = json?.error?.message || json?.message || `USDA request failed (${res.status})`;
        throw new Error(msg);
    }
    return json;
}

function mapFoodSearchItem(item) {
    return {
        fdcId: item.fdcId,
        description: item.description || "",
        brandName: item.brandOwner || item.brandName || null,
        dataType: item.dataType || null,
        servingSize: item.servingSize ?? null,
        servingSizeUnit: item.servingSizeUnit || null,
        foodNutrients: Array.isArray(item.foodNutrients) ? item.foodNutrients : [],
    };
}

function nutrientMap(food) {
    const entries = Array.isArray(food.foodNutrients) ? food.foodNutrients : [];
    const out = {};
    for (const n of entries) {
        const name = n?.nutrient?.name || n?.nutrientName;
        const val = n?.amount;
        if (!name || val == null) continue;
        out[name] = Number(val);
    }
    return out;
}

/**
 * Search USDA foods by name.
 * Returns normalized result rows with fdcId and metadata.
 */
export async function searchFoodsByName(query, { pageSize = 25, pageNumber = 1 } = {}) {
    const q = String(query || "").trim();
    if (!q) return [];

    const body = {
        query: q,
        pageSize: Math.max(1, Math.min(50, Number(pageSize) || 25)),
        pageNumber: Math.max(1, Number(pageNumber) || 1),
    };
    const json = await usdaFetch("/foods/search", { method: "POST", body });
    const foods = Array.isArray(json.foods) ? json.foods : [];
    return foods.map(mapFoodSearchItem);
}

/**
 * Get detailed USDA nutrition data by FDC id.
 */
export async function getFoodDetails(fdcId) {
    const id = Number(fdcId);
    if (!Number.isFinite(id) || id <= 0) {
        throw new Error("Invalid fdcId");
    }
    const json = await usdaFetch(`/food/${id}`);
    return {
        fdcId: json.fdcId,
        description: json.description || "",
        dataType: json.dataType || null,
        brandName: json.brandOwner || json.brandName || null,
        servingSize: json.servingSize ?? null,
        servingSizeUnit: json.servingSizeUnit || null,
        nutrientsByName: nutrientMap(json),
        raw: json,
    };
}

