import { API } from "@/lib/api/api-client";
import { ApiResponse } from "@/types/api-response";
import {
	PromotionPreviewResponseData,
	PromotionPreviewDto,
	PromoteStudentsDto,
	PromoteStudentsResult,
} from "../types/promotion.types";

export const promotionApi = {
	getPreview: (params: PromotionPreviewDto): Promise<ApiResponse<PromotionPreviewResponseData>> =>
		API.get("/enrolment/promotion-preview", { params }),

	promote: (data: PromoteStudentsDto): Promise<ApiResponse<PromoteStudentsResult>> =>
		API.post("/enrolment/promote", data),
};