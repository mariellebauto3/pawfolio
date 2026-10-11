// Made-up adoptions (SEC-PRIV-06): Ana Santos adopted Luna, as in the LoFi. The same adoption is named on Luna's
// resume (`hired_by`) and on Ana's Home Profile (`adopted_pets`); request 6 is its record (AL-04).

export type MockAdoption = {
  id: number;
  pet_id: number;
  home_profile_id: number;
  adoption_request_id: number;
  adopted_at: string;
};

export const ADOPTIONS: MockAdoption[] = [{ id: 1, pet_id: 4, home_profile_id: 1, adoption_request_id: 6, adopted_at: "2026-09-27T09:15:00.000000Z" }];
