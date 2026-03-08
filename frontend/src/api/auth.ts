import apiClient from "./client";

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export const mockLogin = async (nickname: string): Promise<TokenResponse> => {
  const response = await apiClient.post<TokenResponse>("/auth/login/mock", { nickname });
  return response.data;
};

export const socialLogin = async (provider: string, accessToken: string): Promise<TokenResponse> => {
  const response = await apiClient.post<TokenResponse>("/auth/login/social", {
    provider,
    access_token: accessToken,
  });
  return response.data;
};
export const deleteAccount = async (): Promise<void> => {
  await apiClient.delete("/auth/me");
};
