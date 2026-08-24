import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authApi } from "@/features/auth/services/auth.api";
import { userApi } from "@/features/user/services/user.api";
import { RegisterDto, AcceptInviteDto } from "@/features/auth/types/auth.types";
import { UserProfileResponseData } from "@/features/user/types/user.types";
import { RegisterResponseData } from "@/features/auth/types/auth.types";

interface AuthState {
	user: UserProfileResponseData | null;
	isAuthenticated: boolean;
	isLoading: boolean;
	mustChangePassword: boolean;

	login: (email: string, password: string) => Promise<void>;
	register: (data: RegisterDto) => Promise<RegisterResponseData>;
	logout: () => void;
	fetchCurrentUser: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>()(
	persist(
		(set) => ({
			user: null,
			isAuthenticated: false,
			isLoading: false,
			mustChangePassword: false,

			login: async (email: string, password: string) => {
				set({ isLoading: true });
				const res = await authApi.login({ email, password });
				if (!res.success) {
					set({ isLoading: false });
					throw res;
				}
				set({ isAuthenticated: true, isLoading: false });
				const profileRes = await userApi.getProfile();
				if (profileRes.success) {
					set({
						user: profileRes.data,
						mustChangePassword: profileRes.data.mustChangePassword,
					});
				}
			},

			register: async (data: RegisterDto) => {
				set({ isLoading: true });
				const res = await authApi.register(data);
				set({ isLoading: false });
				if (!res.success) {
					throw res;
				}
				return res.data;
			},

			acceptInvite: async (data: AcceptInviteDto) => {
				set({ isLoading: true });
				const res = await authApi.acceptInvite(data);
				if (!res.success) {
					set({ isLoading: false });
					throw res;
				}
				set({ isAuthenticated: true, isLoading: false });
				const profileRes = await userApi.getProfile();
				if (profileRes.success) {
					set({ user: profileRes.data });
				}
			},

			logout: () => {
				authApi.logout().catch(() => {});
				set({ user: null, isAuthenticated: false });
			},

			fetchCurrentUser: async () => {
				try {
					const res = await userApi.getProfile();
					if (res.success) {
						set({
							user: res.data,
							isAuthenticated: true,
							mustChangePassword: res.data.mustChangePassword,
						});
						return true;
					}
				} catch {
					// no valid session
				}
				set({ user: null, isAuthenticated: false });
				return false;
			},

			clearMustChangePassword: () => set({ mustChangePassword: false }),
		}),
		{
			name: "school-portal-auth",
			partialize: (state) => ({
				user: state.user,
				isAuthenticated: state.isAuthenticated,
				mustChangePassword: state.mustChangePassword,
			}),
		}
	)
);