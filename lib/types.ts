export type ExtractedItem = {
    label: string | null;
    values?: number[];
    rows?: {
        time: number | null;
        bracket: number | null;
        value: number | null;
        raw: string;
    }[];
    raw: string;
};

export type ExtractedData = {
    items: ExtractedItem[];
};

export type WeightedRawData = {
    tare1: number | null;
    total1: number | null;
    salinity1: number | null;
    tare2: number | null;
    total2: number | null;
    temperature: number | null;
};

export type CalculationItem = {
    label: string;
    salinity: number | null;
    temperature: number | null;
    temperatureValid: boolean;
    raw: string;
    capacity?: number | null;
    type: "simple" | "weighted";
    weighted?: WeightedRawData;
};

export type ApiResult = {
    ok: boolean;
    error?: string;
    data?: ExtractedData;
    calculation?: CalculationItem[];
};
