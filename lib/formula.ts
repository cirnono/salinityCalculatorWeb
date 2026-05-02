import type {
    CalculationItem,
    ExtractedData,
    ExtractedItem,
    WeightedRawData,
} from "./types";

import {
    getProductCode,
    PRODUCT_INGREDIENT_RATIO,
    type IngredientCode,
} from "./config";

function isTemperatureValid(temp: number | null): boolean {
    if (temp === null) return false;
    return temp >= 19 && temp <= 21;
}

export function calculateWeightedSalinity(raw: WeightedRawData): number | null {
    const { tare1, total1, salinity1, tare2, total2 } = raw;

    if (
        tare1 === null ||
        total1 === null ||
        salinity1 === null ||
        tare2 === null ||
        total2 === null
    ) {
        return null;
    }

    const liquid1 = total1 - tare1;
    const liquid2 = total2 - tare2;

    if (liquid1 < 0 || liquid2 <= 0) {
        return null;
    }

    return ((liquid1 + liquid2) * salinity1) / liquid2;
}

export function recalculateItem(item: CalculationItem): CalculationItem {
    if (item.type !== "weighted" || !item.weighted) {
        const temperatureValid = isTemperatureValid(item.temperature);

        return {
            ...item,
            temperatureValid,
        };
    }

    const salinity = calculateWeightedSalinity(item.weighted);
    const temperature = item.weighted.temperature;
    const temperatureValid = isTemperatureValid(temperature);

    return {
        ...item,
        salinity,
        temperature,
        temperatureValid,
    };
}

function getSimpleItemResult(item: ExtractedItem): CalculationItem {
    const salinity = item.values?.[0] ?? null;
    const temperature = item.values?.[1] ?? null;
    const temperatureValid = isTemperatureValid(temperature);

    return {
        label: item.label ?? "未知",
        salinity,
        temperature,
        temperatureValid,
        raw: item.raw,
        type: "simple",
    };
}

function getWeightedItemResult(item: ExtractedItem): CalculationItem {
    const row1 = item.rows?.[0];
    const row2 = item.rows?.[1];

    const weighted: WeightedRawData = {
        tare1: row1?.time ?? null,
        total1: row1?.bracket ?? null,
        salinity1: row1?.value ?? null,
        tare2: row2?.time ?? null,
        total2: row2?.bracket ?? null,
        temperature: row2?.value ?? null,
    };

    const base: CalculationItem = {
        label: item.label ?? "未知",
        salinity: null,
        temperature: weighted.temperature,
        temperatureValid: false,
        raw: item.raw,
        type: "weighted",
        weighted,
    };

    return recalculateItem(base);
}

export function calculateFromExtractedData(
    data: ExtractedData,
): CalculationItem[] {
    return data.items.map((item) => {
        if (item.rows && item.rows.length > 0) {
            return getWeightedItemResult(item);
        }

        return getSimpleItemResult(item);
    });
}

export function calculateSaltToAdd(
    targetSalinity: number | null,
    currentSalinity: number | null,
    capacity: number | null | undefined,
): number | null {
    if (
        targetSalinity === null ||
        currentSalinity === null ||
        capacity === null ||
        capacity === undefined
    ) {
        return null;
    }

    const result = (targetSalinity - currentSalinity) * capacity * 10;
    return Math.max(result, 0);
}

export function calculateIngredients(
    label: string | null,
    saltToAdd: number | null,
): string | null {
    if (saltToAdd === null) return null;

    const productCode = getProductCode(label);
    if (!productCode) return null;

    const ratios = PRODUCT_INGREDIENT_RATIO[productCode];

    const amounts: Partial<Record<IngredientCode, number>> = {};

    for (const [ingredient, ratio] of Object.entries(ratios)) {
        const key = ingredient as IngredientCode;

        if (key === "chickenPowder") continue;
        if (productCode === "pork" && key === "oysterSauce") continue;

        amounts[key] = saltToAdd * ratio;
    }

    for (const ingredient of Object.keys(ratios) as IngredientCode[]) {
        const special = calculateSpecialIngredient(
            productCode,
            ingredient,
            saltToAdd,
            amounts,
        );

        if (special !== null) {
            amounts[ingredient] = special;
        }
    }

    const outputOrder: IngredientCode[] = [
        "salt",
        "MSG",
        "rockSugar",
        "soySauce",
        "oysterSauce",
        "chickenPowder",
    ];

    return outputOrder
        .filter((ingredient) => amounts[ingredient] !== undefined)
        .map((ingredient) => Math.floor(amounts[ingredient] ?? 0))
        .join("/");
}

function floorToMultiple(value: number, step: number): number {
    return Math.floor(value / step) * step;
}

function ceilToMultiple(value: number, step: number): number {
    return Math.ceil(value / step) * step;
}

function calculateSpecialIngredient(
    productCode: string,
    ingredient: IngredientCode,
    baseSalt: number,
    currentAmounts: Partial<Record<IngredientCode, number>>,
): number | null {
    // 猪：蚝油 = 盐 / 10 后取 floor
    if (
        (productCode === "pork" || productCode === "feet") &&
        ingredient === "oysterSauce"
    ) {
        return floorToMultiple(baseSalt / 10, 5);
    }

    // 牛 / 辣：蚝油 = 盐 / 10，然后向上取 5 的倍数
    if (
        (productCode === "beef" || productCode === "spicy") &&
        ingredient === "oysterSauce"
    ) {
        return ceilToMultiple(baseSalt / 10, 5);
    }

    // 鸡：鸡粉由味精决定
    // 味精 >= 50，则鸡粉 = 味精 - 10
    // 否则鸡粉 = 味精 - 5
    if (productCode === "chicken" && ingredient === "chickenPowder") {
        const msg = currentAmounts.MSG;

        if (msg === undefined) return null;

        return msg >= 50 ? msg - 10 : msg - 5;
    }

    return null;
}
