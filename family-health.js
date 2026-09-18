/**
 * ============================================================================
 * FAMILY HEALTH TRACKER - SỨC KHỎE GIA ĐÌNH
 * Theo dõi cân nặng, chiều cao, đánh giá chuẩn BMI Châu Á & Tăng trưởng WHO
 * Tuân thủ quy chuẩn thiết kế GEMINI.md
 * ============================================================================
 */

(function () {
  'use strict';

  // --- HẰNG SỐ & TIÊU CHUẨN Y TẾ ---
  const STORAGE_KEYS = {
    MEMBERS: 'family_health_members_v1',
    LOGS: 'family_health_logs_v1',
  };

  // Dữ liệu chuẩn WHO BMI-for-age (5 - 18 tuổi)
  // [age]: { sdMinus2: Thiếu cân/thấp còi, median: Trung vị, sdPlus1: Nguy cơ thừa cân, sdPlus2: Béo phì }
  const WHO_BMI_BOYS = {
    0: { sdMinus2: 11.1, median: 13.4, sdPlus1: 14.8, sdPlus2: 16.3 },
    1: { sdMinus2: 13.4, median: 15.3, sdPlus1: 16.4, sdPlus2: 17.8 },
    2: { sdMinus2: 13.5, median: 15.7, sdPlus1: 16.9, sdPlus2: 18.4 },
    3: { sdMinus2: 13.2, median: 15.4, sdPlus1: 16.6, sdPlus2: 18.1 },
    4: { sdMinus2: 13.0, median: 15.3, sdPlus1: 16.5, sdPlus2: 18.0 },
    5: { sdMinus2: 13.0, median: 15.3, sdPlus1: 16.6, sdPlus2: 18.3 },
    6: { sdMinus2: 13.0, median: 15.3, sdPlus1: 16.8, sdPlus2: 18.5 },
    7: { sdMinus2: 13.1, median: 15.5, sdPlus1: 17.0, sdPlus2: 19.0 },
    8: { sdMinus2: 13.3, median: 15.7, sdPlus1: 17.4, sdPlus2: 19.7 },
    9: { sdMinus2: 13.5, median: 16.1, sdPlus1: 17.9, sdPlus2: 20.5 },
    10: { sdMinus2: 13.7, median: 16.4, sdPlus1: 18.5, sdPlus2: 21.4 },
    11: { sdMinus2: 14.1, median: 16.9, sdPlus1: 19.2, sdPlus2: 22.5 },
    12: { sdMinus2: 14.5, median: 17.5, sdPlus1: 19.9, sdPlus2: 23.6 },
    13: { sdMinus2: 14.9, median: 18.2, sdPlus1: 20.8, sdPlus2: 24.8 },
    14: { sdMinus2: 15.5, median: 19.0, sdPlus1: 21.8, sdPlus2: 25.9 },
    15: { sdMinus2: 16.0, median: 19.8, sdPlus1: 22.7, sdPlus2: 27.0 },
    16: { sdMinus2: 16.5, median: 20.5, sdPlus1: 23.5, sdPlus2: 27.9 },
    17: { sdMinus2: 16.9, median: 21.1, sdPlus1: 24.3, sdPlus2: 28.6 },
    18: { sdMinus2: 17.3, median: 21.6, sdPlus1: 24.9, sdPlus2: 29.2 }
  };

  const WHO_BMI_GIRLS = {
    0: { sdMinus2: 10.8, median: 13.2, sdPlus1: 14.6, sdPlus2: 16.1 },
    1: { sdMinus2: 13.1, median: 14.9, sdPlus1: 16.1, sdPlus2: 17.5 },
    2: { sdMinus2: 13.2, median: 15.3, sdPlus1: 16.6, sdPlus2: 18.2 },
    3: { sdMinus2: 12.9, median: 15.1, sdPlus1: 16.4, sdPlus2: 18.0 },
    4: { sdMinus2: 12.7, median: 15.0, sdPlus1: 16.4, sdPlus2: 18.0 },
    5: { sdMinus2: 12.7, median: 15.2, sdPlus1: 16.6, sdPlus2: 18.3 },
    6: { sdMinus2: 12.7, median: 15.3, sdPlus1: 16.8, sdPlus2: 18.8 },
    7: { sdMinus2: 12.7, median: 15.4, sdPlus1: 17.1, sdPlus2: 19.3 },
    8: { sdMinus2: 12.9, median: 15.7, sdPlus1: 17.7, sdPlus2: 20.1 },
    9: { sdMinus2: 13.1, median: 16.1, sdPlus1: 18.3, sdPlus2: 21.0 },
    10: { sdMinus2: 13.5, median: 16.6, sdPlus1: 19.0, sdPlus2: 22.0 },
    11: { sdMinus2: 13.9, median: 17.2, sdPlus1: 19.9, sdPlus2: 23.2 },
    12: { sdMinus2: 14.4, median: 18.0, sdPlus1: 20.8, sdPlus2: 24.4 },
    13: { sdMinus2: 14.9, median: 18.8, sdPlus1: 21.7, sdPlus2: 25.5 },
    14: { sdMinus2: 15.4, median: 19.6, sdPlus1: 22.7, sdPlus2: 26.5 },
    15: { sdMinus2: 15.9, median: 20.2, sdPlus1: 23.4, sdPlus2: 27.4 },
    16: { sdMinus2: 16.2, median: 20.7, sdPlus1: 24.1, sdPlus2: 28.1 },
    17: { sdMinus2: 16.4, median: 21.0, sdPlus1: 24.5, sdPlus2: 28.6 },
    18: { sdMinus2: 16.6, median: 21.3, sdPlus1: 24.8, sdPlus2: 28.9 }
  };

  // Chuẩn WHO Chiều cao theo tuổi (Height-for-age, cm) từ 0 đến 18 tuổi
  // [age]: { sdMinus2: Thấp còi (-2SD), median: Chuẩn trung vị (50th), sdPlus2: Vượt chuẩn (+2SD) }
  const WHO_HEIGHT_BOYS = {
    0: { sdMinus2: 46.1, median: 49.9, sdPlus2: 53.7 },
    1: { sdMinus2: 71.0, median: 75.7, sdPlus2: 80.5 },
    2: { sdMinus2: 81.7, median: 87.8, sdPlus2: 93.9 },
    3: { sdMinus2: 88.7, median: 96.1, sdPlus2: 103.5 },
    4: { sdMinus2: 94.9, median: 103.3, sdPlus2: 111.7 },
    5: { sdMinus2: 100.7, median: 110.0, sdPlus2: 119.2 },
    6: { sdMinus2: 106.1, median: 116.0, sdPlus2: 125.8 },
    7: { sdMinus2: 111.2, median: 121.7, sdPlus2: 132.2 },
    8: { sdMinus2: 116.0, median: 127.3, sdPlus2: 138.6 },
    9: { sdMinus2: 120.5, median: 132.6, sdPlus2: 144.6 },
    10: { sdMinus2: 125.0, median: 137.8, sdPlus2: 150.7 },
    11: { sdMinus2: 129.6, median: 143.1, sdPlus2: 156.7 },
    12: { sdMinus2: 134.9, median: 149.1, sdPlus2: 163.7 },
    13: { sdMinus2: 141.2, median: 156.0, sdPlus2: 171.0 },
    14: { sdMinus2: 147.8, median: 163.2, sdPlus2: 178.6 },
    15: { sdMinus2: 153.4, median: 169.0, sdPlus2: 184.6 },
    16: { sdMinus2: 157.3, median: 172.9, sdPlus2: 188.5 },
    17: { sdMinus2: 159.4, median: 175.1, sdPlus2: 190.8 },
    18: { sdMinus2: 160.3, median: 176.1, sdPlus2: 191.9 }
  };

  const WHO_HEIGHT_GIRLS = {
    0: { sdMinus2: 45.4, median: 49.1, sdPlus2: 52.9 },
    1: { sdMinus2: 68.9, median: 74.0, sdPlus2: 79.2 },
    2: { sdMinus2: 80.0, median: 86.4, sdPlus2: 92.9 },
    3: { sdMinus2: 87.4, median: 95.1, sdPlus2: 102.7 },
    4: { sdMinus2: 94.1, median: 102.7, sdPlus2: 111.3 },
    5: { sdMinus2: 99.9, median: 109.4, sdPlus2: 118.9 },
    6: { sdMinus2: 105.3, median: 115.1, sdPlus2: 124.9 },
    7: { sdMinus2: 110.4, median: 120.8, sdPlus2: 131.2 },
    8: { sdMinus2: 115.3, median: 126.4, sdPlus2: 137.4 },
    9: { sdMinus2: 120.3, median: 132.2, sdPlus2: 144.0 },
    10: { sdMinus2: 125.8, median: 138.3, sdPlus2: 150.9 },
    11: { sdMinus2: 131.7, median: 144.8, sdPlus2: 157.9 },
    12: { sdMinus2: 137.6, median: 151.2, sdPlus2: 164.7 },
    13: { sdMinus2: 142.3, median: 155.7, sdPlus2: 169.1 },
    14: { sdMinus2: 145.0, median: 158.0, sdPlus2: 171.1 },
    15: { sdMinus2: 146.4, median: 159.2, sdPlus2: 172.0 },
    16: { sdMinus2: 147.0, median: 159.8, sdPlus2: 172.6 },
    17: { sdMinus2: 147.3, median: 160.0, sdPlus2: 172.8 },
    18: { sdMinus2: 147.4, median: 160.2, sdPlus2: 173.0 }
  };

  // Chuẩn WHO Cân nặng theo tuổi (Weight-for-age, kg) từ 0 đến 18 tuổi
  // [age]: { sdMinus2: Nhẹ cân (-2SD), median: Chuẩn trung vị (50th), sdPlus2: Vượt chuẩn (+2SD) }
  const WHO_WEIGHT_BOYS = {
    0: { sdMinus2: 2.5, median: 3.3, sdPlus2: 4.4 },
    1: { sdMinus2: 7.7, median: 9.6, sdPlus2: 12.0 },
    2: { sdMinus2: 9.7, median: 12.2, sdPlus2: 15.3 },
    3: { sdMinus2: 11.3, median: 14.3, sdPlus2: 18.3 },
    4: { sdMinus2: 12.7, median: 16.3, sdPlus2: 21.2 },
    5: { sdMinus2: 14.1, median: 18.3, sdPlus2: 24.2 },
    6: { sdMinus2: 15.9, median: 20.5, sdPlus2: 27.1 },
    7: { sdMinus2: 17.7, median: 22.9, sdPlus2: 30.7 },
    8: { sdMinus2: 19.7, median: 25.6, sdPlus2: 34.7 },
    9: { sdMinus2: 21.8, median: 28.6, sdPlus2: 39.4 },
    10: { sdMinus2: 24.2, median: 32.0, sdPlus2: 44.8 },
    11: { sdMinus2: 26.8, median: 35.6, sdPlus2: 50.8 },
    12: { sdMinus2: 29.9, median: 39.9, sdPlus2: 57.5 },
    13: { sdMinus2: 33.6, median: 45.3, sdPlus2: 64.9 },
    14: { sdMinus2: 38.3, median: 50.8, sdPlus2: 72.3 },
    15: { sdMinus2: 43.0, median: 56.0, sdPlus2: 79.1 },
    16: { sdMinus2: 47.2, median: 60.5, sdPlus2: 84.7 },
    17: { sdMinus2: 50.2, median: 63.8, sdPlus2: 88.6 },
    18: { sdMinus2: 52.0, median: 65.8, sdPlus2: 91.0 }
  };

  const WHO_WEIGHT_GIRLS = {
    0: { sdMinus2: 2.4, median: 3.2, sdPlus2: 4.2 },
    1: { sdMinus2: 7.0, median: 8.9, sdPlus2: 11.5 },
    2: { sdMinus2: 9.0, median: 11.5, sdPlus2: 14.8 },
    3: { sdMinus2: 10.8, median: 13.9, sdPlus2: 18.1 },
    4: { sdMinus2: 12.3, median: 16.1, sdPlus2: 21.5 },
    5: { sdMinus2: 13.7, median: 18.2, sdPlus2: 24.9 },
    6: { sdMinus2: 15.3, median: 20.2, sdPlus2: 27.8 },
    7: { sdMinus2: 16.8, median: 22.4, sdPlus2: 31.4 },
    8: { sdMinus2: 18.6, median: 25.0, sdPlus2: 35.8 },
    9: { sdMinus2: 20.8, median: 28.2, sdPlus2: 41.0 },
    10: { sdMinus2: 23.3, median: 31.9, sdPlus2: 46.9 },
    11: { sdMinus2: 26.2, median: 36.3, sdPlus2: 53.5 },
    12: { sdMinus2: 29.8, median: 41.5, sdPlus2: 60.5 },
    13: { sdMinus2: 34.0, median: 46.1, sdPlus2: 66.7 },
    14: { sdMinus2: 38.3, median: 49.8, sdPlus2: 71.0 },
    15: { sdMinus2: 41.5, median: 52.3, sdPlus2: 73.9 },
    16: { sdMinus2: 43.3, median: 53.6, sdPlus2: 75.3 },
    17: { sdMinus2: 44.2, median: 54.3, sdPlus2: 76.1 },
    18: { sdMinus2: 44.7, median: 54.7, sdPlus2: 76.5 }
  };

  // ============================================================================
  // CHUẨN WHO TĂNG TRƯỞNG THEO TỪNG THÁNG TUỔI CHO TRẺ EM (0 - 36 THÁNG TUỔI)
  // [tháng]: { weight: {sdMinus2, median, sdPlus2}, height: {sdMinus2, median, sdPlus2}, bmi: {sdMinus2, median, sdPlus1, sdPlus2} }
  // Nguồn: WHO Child Growth Standards (0 to 60 months)
  // ============================================================================
  const WHO_MONTHS_BOYS = [
    /* 0m  */ { weight: { sdMinus2: 2.5, median: 3.3, sdPlus2: 4.4 }, height: { sdMinus2: 46.1, median: 49.9, sdPlus2: 53.7 }, bmi: { sdMinus2: 11.1, median: 13.4, sdPlus1: 14.8, sdPlus2: 16.3 } },
    /* 1m  */ { weight: { sdMinus2: 3.4, median: 4.5, sdPlus2: 5.8 }, height: { sdMinus2: 50.8, median: 54.7, sdPlus2: 58.6 }, bmi: { sdMinus2: 12.9, median: 14.9, sdPlus1: 16.3, sdPlus2: 17.8 } },
    /* 2m  */ { weight: { sdMinus2: 4.3, median: 5.6, sdPlus2: 7.1 }, height: { sdMinus2: 54.4, median: 58.4, sdPlus2: 62.4 }, bmi: { sdMinus2: 14.1, median: 16.3, sdPlus1: 17.7, sdPlus2: 19.2 } },
    /* 3m  */ { weight: { sdMinus2: 5.0, median: 6.4, sdPlus2: 8.0 }, height: { sdMinus2: 57.3, median: 61.4, sdPlus2: 65.5 }, bmi: { sdMinus2: 14.7, median: 16.9, sdPlus1: 18.3, sdPlus2: 19.8 } },
    /* 4m  */ { weight: { sdMinus2: 5.6, median: 7.0, sdPlus2: 8.7 }, height: { sdMinus2: 59.7, median: 63.9, sdPlus2: 68.0 }, bmi: { sdMinus2: 14.9, median: 17.2, sdPlus1: 18.6, sdPlus2: 20.0 } },
    /* 5m  */ { weight: { sdMinus2: 6.0, median: 7.5, sdPlus2: 9.3 }, height: { sdMinus2: 61.7, median: 65.9, sdPlus2: 70.1 }, bmi: { sdMinus2: 15.0, median: 17.2, sdPlus1: 18.6, sdPlus2: 20.0 } },
    /* 6m  */ { weight: { sdMinus2: 6.4, median: 7.9, sdPlus2: 9.8 }, height: { sdMinus2: 63.3, median: 67.6, sdPlus2: 71.9 }, bmi: { sdMinus2: 14.9, median: 17.2, sdPlus1: 18.5, sdPlus2: 19.8 } },
    /* 7m  */ { weight: { sdMinus2: 6.7, median: 8.3, sdPlus2: 10.3 }, height: { sdMinus2: 64.8, median: 69.2, sdPlus2: 73.5 }, bmi: { sdMinus2: 14.8, median: 17.1, sdPlus1: 18.4, sdPlus2: 19.7 } },
    /* 8m  */ { weight: { sdMinus2: 6.9, median: 8.6, sdPlus2: 10.7 }, height: { sdMinus2: 66.2, median: 70.6, sdPlus2: 75.0 }, bmi: { sdMinus2: 14.6, median: 17.0, sdPlus1: 18.2, sdPlus2: 19.5 } },
    /* 9m  */ { weight: { sdMinus2: 7.1, median: 8.9, sdPlus2: 11.0 }, height: { sdMinus2: 67.5, median: 72.0, sdPlus2: 76.5 }, bmi: { sdMinus2: 14.5, median: 16.8, sdPlus1: 18.1, sdPlus2: 19.4 } },
    /* 10m */ { weight: { sdMinus2: 7.4, median: 9.2, sdPlus2: 11.4 }, height: { sdMinus2: 68.7, median: 73.3, sdPlus2: 77.9 }, bmi: { sdMinus2: 14.4, median: 16.7, sdPlus1: 17.9, sdPlus2: 19.2 } },
    /* 11m */ { weight: { sdMinus2: 7.6, median: 9.4, sdPlus2: 11.7 }, height: { sdMinus2: 69.9, median: 74.5, sdPlus2: 79.2 }, bmi: { sdMinus2: 14.2, median: 16.6, sdPlus1: 17.8, sdPlus2: 19.1 } },
    /* 12m */ { weight: { sdMinus2: 7.7, median: 9.6, sdPlus2: 12.0 }, height: { sdMinus2: 71.0, median: 75.7, sdPlus2: 80.5 }, bmi: { sdMinus2: 14.1, median: 16.5, sdPlus1: 17.7, sdPlus2: 19.0 } },
    /* 13m */ { weight: { sdMinus2: 7.9, median: 9.9, sdPlus2: 12.3 }, height: { sdMinus2: 72.1, median: 76.9, sdPlus2: 81.8 }, bmi: { sdMinus2: 14.0, median: 16.4, sdPlus1: 17.6, sdPlus2: 18.9 } },
    /* 14m */ { weight: { sdMinus2: 8.1, median: 10.1, sdPlus2: 12.6 }, height: { sdMinus2: 73.1, median: 78.0, sdPlus2: 83.0 }, bmi: { sdMinus2: 13.9, median: 16.3, sdPlus1: 17.5, sdPlus2: 18.8 } },
    /* 15m */ { weight: { sdMinus2: 8.3, median: 10.3, sdPlus2: 12.8 }, height: { sdMinus2: 74.1, median: 79.1, sdPlus2: 84.2 }, bmi: { sdMinus2: 13.8, median: 16.2, sdPlus1: 17.4, sdPlus2: 18.7 } },
    /* 16m */ { weight: { sdMinus2: 8.4, median: 10.5, sdPlus2: 13.1 }, height: { sdMinus2: 75.0, median: 80.2, sdPlus2: 85.4 }, bmi: { sdMinus2: 13.7, median: 16.1, sdPlus1: 17.3, sdPlus2: 18.6 } },
    /* 17m */ { weight: { sdMinus2: 8.6, median: 10.7, sdPlus2: 13.4 }, height: { sdMinus2: 76.0, median: 81.2, sdPlus2: 86.5 }, bmi: { sdMinus2: 13.6, median: 16.0, sdPlus1: 17.2, sdPlus2: 18.5 } },
    /* 18m */ { weight: { sdMinus2: 8.8, median: 10.9, sdPlus2: 13.7 }, height: { sdMinus2: 76.9, median: 82.3, sdPlus2: 87.7 }, bmi: { sdMinus2: 13.5, median: 15.9, sdPlus1: 17.1, sdPlus2: 18.4 } },
    /* 19m */ { weight: { sdMinus2: 8.9, median: 11.1, sdPlus2: 13.9 }, height: { sdMinus2: 77.7, median: 83.2, sdPlus2: 88.8 }, bmi: { sdMinus2: 13.5, median: 15.8, sdPlus1: 17.0, sdPlus2: 18.4 } },
    /* 20m */ { weight: { sdMinus2: 9.1, median: 11.3, sdPlus2: 14.2 }, height: { sdMinus2: 78.6, median: 84.2, sdPlus2: 89.8 }, bmi: { sdMinus2: 13.4, median: 15.8, sdPlus1: 17.0, sdPlus2: 18.3 } },
    /* 21m */ { weight: { sdMinus2: 9.2, median: 11.5, sdPlus2: 14.5 }, height: { sdMinus2: 79.4, median: 85.1, sdPlus2: 90.9 }, bmi: { sdMinus2: 13.4, median: 15.7, sdPlus1: 16.9, sdPlus2: 18.3 } },
    /* 22m */ { weight: { sdMinus2: 9.4, median: 11.8, sdPlus2: 14.7 }, height: { sdMinus2: 80.2, median: 86.0, sdPlus2: 91.9 }, bmi: { sdMinus2: 13.3, median: 15.7, sdPlus1: 16.9, sdPlus2: 18.2 } },
    /* 23m */ { weight: { sdMinus2: 9.5, median: 12.0, sdPlus2: 15.0 }, height: { sdMinus2: 81.0, median: 86.9, sdPlus2: 92.9 }, bmi: { sdMinus2: 13.3, median: 15.6, sdPlus1: 16.8, sdPlus2: 18.2 } },
    /* 24m */ { weight: { sdMinus2: 9.7, median: 12.2, sdPlus2: 15.3 }, height: { sdMinus2: 81.7, median: 87.8, sdPlus2: 93.9 }, bmi: { sdMinus2: 13.3, median: 15.6, sdPlus1: 16.8, sdPlus2: 18.2 } },
    /* 25m */ { weight: { sdMinus2: 9.9, median: 12.4, sdPlus2: 15.6 }, height: { sdMinus2: 82.5, median: 88.7, sdPlus2: 94.9 }, bmi: { sdMinus2: 13.2, median: 15.6, sdPlus1: 16.7, sdPlus2: 18.1 } },
    /* 26m */ { weight: { sdMinus2: 10.1, median: 12.7, sdPlus2: 16.0 }, height: { sdMinus2: 83.3, median: 89.6, sdPlus2: 95.8 }, bmi: { sdMinus2: 13.2, median: 15.5, sdPlus1: 16.7, sdPlus2: 18.1 } },
    /* 27m */ { weight: { sdMinus2: 10.3, median: 12.9, sdPlus2: 16.3 }, height: { sdMinus2: 84.1, median: 90.4, sdPlus2: 96.7 }, bmi: { sdMinus2: 13.2, median: 15.5, sdPlus1: 16.7, sdPlus2: 18.1 } },
    /* 28m */ { weight: { sdMinus2: 10.5, median: 13.1, sdPlus2: 16.6 }, height: { sdMinus2: 84.8, median: 91.2, sdPlus2: 97.6 }, bmi: { sdMinus2: 13.1, median: 15.4, sdPlus1: 16.6, sdPlus2: 18.1 } },
    /* 29m */ { weight: { sdMinus2: 10.7, median: 13.4, sdPlus2: 17.0 }, height: { sdMinus2: 85.5, median: 92.0, sdPlus2: 98.5 }, bmi: { sdMinus2: 13.1, median: 15.4, sdPlus1: 16.6, sdPlus2: 18.1 } },
    /* 30m */ { weight: { sdMinus2: 10.8, median: 13.6, sdPlus2: 17.3 }, height: { sdMinus2: 86.2, median: 92.8, sdPlus2: 99.4 }, bmi: { sdMinus2: 13.1, median: 15.4, sdPlus1: 16.6, sdPlus2: 18.1 } },
    /* 31m */ { weight: { sdMinus2: 11.0, median: 13.8, sdPlus2: 17.6 }, height: { sdMinus2: 86.9, median: 93.5, sdPlus2: 100.2 }, bmi: { sdMinus2: 13.0, median: 15.3, sdPlus1: 16.5, sdPlus2: 18.0 } },
    /* 32m */ { weight: { sdMinus2: 11.2, median: 14.1, sdPlus2: 17.9 }, height: { sdMinus2: 87.5, median: 94.3, sdPlus2: 101.0 }, bmi: { sdMinus2: 13.0, median: 15.3, sdPlus1: 16.5, sdPlus2: 18.0 } },
    /* 33m */ { weight: { sdMinus2: 11.3, median: 14.3, sdPlus2: 18.2 }, height: { sdMinus2: 88.2, median: 95.0, sdPlus2: 101.8 }, bmi: { sdMinus2: 13.0, median: 15.3, sdPlus1: 16.5, sdPlus2: 18.0 } },
    /* 34m */ { weight: { sdMinus2: 11.5, median: 14.5, sdPlus2: 18.5 }, height: { sdMinus2: 88.8, median: 95.7, sdPlus2: 102.6 }, bmi: { sdMinus2: 13.0, median: 15.3, sdPlus1: 16.5, sdPlus2: 18.0 } },
    /* 35m */ { weight: { sdMinus2: 11.7, median: 14.7, sdPlus2: 18.8 }, height: { sdMinus2: 89.4, median: 96.4, sdPlus2: 103.3 }, bmi: { sdMinus2: 13.0, median: 15.3, sdPlus1: 16.5, sdPlus2: 18.0 } },
    /* 36m */ { weight: { sdMinus2: 11.8, median: 14.9, sdPlus2: 19.0 }, height: { sdMinus2: 90.0, median: 97.0, sdPlus2: 104.0 }, bmi: { sdMinus2: 13.0, median: 15.3, sdPlus1: 16.5, sdPlus2: 18.0 } }
  ];

  const WHO_MONTHS_GIRLS = [
    /* 0m  */ { weight: { sdMinus2: 2.4, median: 3.2, sdPlus2: 4.2 }, height: { sdMinus2: 45.4, median: 49.1, sdPlus2: 52.9 }, bmi: { sdMinus2: 10.8, median: 13.2, sdPlus1: 14.6, sdPlus2: 16.1 } },
    /* 1m  */ { weight: { sdMinus2: 3.2, median: 4.2, sdPlus2: 5.5 }, height: { sdMinus2: 49.8, median: 53.7, sdPlus2: 57.6 }, bmi: { sdMinus2: 12.5, median: 14.6, sdPlus1: 16.0, sdPlus2: 17.4 } },
    /* 2m  */ { weight: { sdMinus2: 3.9, median: 5.1, sdPlus2: 6.6 }, height: { sdMinus2: 53.0, median: 57.1, sdPlus2: 61.1 }, bmi: { sdMinus2: 13.5, median: 15.8, sdPlus1: 17.2, sdPlus2: 18.7 } },
    /* 3m  */ { weight: { sdMinus2: 4.5, median: 5.8, sdPlus2: 7.5 }, height: { sdMinus2: 55.6, median: 59.8, sdPlus2: 64.0 }, bmi: { sdMinus2: 14.0, median: 16.3, sdPlus1: 17.8, sdPlus2: 19.2 } },
    /* 4m  */ { weight: { sdMinus2: 5.0, median: 6.4, sdPlus2: 8.2 }, height: { sdMinus2: 57.8, median: 62.1, sdPlus2: 66.4 }, bmi: { sdMinus2: 14.1, median: 16.4, sdPlus1: 17.9, sdPlus2: 19.3 } },
    /* 5m  */ { weight: { sdMinus2: 5.4, median: 6.9, sdPlus2: 8.8 }, height: { sdMinus2: 59.6, median: 64.0, sdPlus2: 68.5 }, bmi: { sdMinus2: 14.1, median: 16.4, sdPlus1: 17.9, sdPlus2: 19.3 } },
    /* 6m  */ { weight: { sdMinus2: 5.7, median: 7.3, sdPlus2: 9.3 }, height: { sdMinus2: 61.2, median: 65.7, sdPlus2: 70.3 }, bmi: { sdMinus2: 14.0, median: 16.3, sdPlus1: 17.7, sdPlus2: 19.1 } },
    /* 7m  */ { weight: { sdMinus2: 6.0, median: 7.6, sdPlus2: 9.8 }, height: { sdMinus2: 62.7, median: 67.3, sdPlus2: 71.9 }, bmi: { sdMinus2: 13.9, median: 16.2, sdPlus1: 17.6, sdPlus2: 18.9 } },
    /* 8m  */ { weight: { sdMinus2: 6.3, median: 7.9, sdPlus2: 10.2 }, height: { sdMinus2: 64.0, median: 68.7, sdPlus2: 73.5 }, bmi: { sdMinus2: 13.7, median: 16.0, sdPlus1: 17.4, sdPlus2: 18.7 } },
    /* 9m  */ { weight: { sdMinus2: 6.5, median: 8.2, sdPlus2: 10.5 }, height: { sdMinus2: 65.3, median: 70.1, sdPlus2: 75.0 }, bmi: { sdMinus2: 13.5, median: 15.8, sdPlus1: 17.2, sdPlus2: 18.5 } },
    /* 10m */ { weight: { sdMinus2: 6.7, median: 8.5, sdPlus2: 10.9 }, height: { sdMinus2: 66.5, median: 71.5, sdPlus2: 76.4 }, bmi: { sdMinus2: 13.4, median: 15.7, sdPlus1: 17.1, sdPlus2: 18.4 } },
    /* 11m */ { weight: { sdMinus2: 6.9, median: 8.7, sdPlus2: 11.2 }, height: { sdMinus2: 67.7, median: 72.8, sdPlus2: 77.8 }, bmi: { sdMinus2: 13.3, median: 15.6, sdPlus1: 17.0, sdPlus2: 18.2 } },
    /* 12m */ { weight: { sdMinus2: 7.0, median: 8.9, sdPlus2: 11.5 }, height: { sdMinus2: 68.9, median: 74.0, sdPlus2: 79.2 }, bmi: { sdMinus2: 13.1, median: 15.4, sdPlus1: 16.8, sdPlus2: 18.1 } },
    /* 13m */ { weight: { sdMinus2: 7.2, median: 9.2, sdPlus2: 11.8 }, height: { sdMinus2: 70.0, median: 75.2, sdPlus2: 80.5 }, bmi: { sdMinus2: 13.0, median: 15.3, sdPlus1: 16.7, sdPlus2: 17.9 } },
    /* 14m */ { weight: { sdMinus2: 7.4, median: 9.4, sdPlus2: 12.1 }, height: { sdMinus2: 71.0, median: 76.4, sdPlus2: 81.7 }, bmi: { sdMinus2: 12.9, median: 15.2, sdPlus1: 16.6, sdPlus2: 17.8 } },
    /* 15m */ { weight: { sdMinus2: 7.6, median: 9.6, sdPlus2: 12.4 }, height: { sdMinus2: 72.0, median: 77.5, sdPlus2: 83.0 }, bmi: { sdMinus2: 12.8, median: 15.1, sdPlus1: 16.5, sdPlus2: 17.7 } },
    /* 16m */ { weight: { sdMinus2: 7.7, median: 9.8, sdPlus2: 12.6 }, height: { sdMinus2: 73.0, median: 78.6, sdPlus2: 84.2 }, bmi: { sdMinus2: 12.7, median: 15.0, sdPlus1: 16.4, sdPlus2: 17.6 } },
    /* 17m */ { weight: { sdMinus2: 7.9, median: 10.0, sdPlus2: 12.9 }, height: { sdMinus2: 74.0, median: 79.7, sdPlus2: 85.4 }, bmi: { sdMinus2: 12.6, median: 14.9, sdPlus1: 16.3, sdPlus2: 17.5 } },
    /* 18m */ { weight: { sdMinus2: 8.1, median: 10.2, sdPlus2: 13.2 }, height: { sdMinus2: 74.9, median: 80.7, sdPlus2: 86.5 }, bmi: { sdMinus2: 12.6, median: 14.8, sdPlus1: 16.2, sdPlus2: 17.4 } },
    /* 19m */ { weight: { sdMinus2: 8.2, median: 10.4, sdPlus2: 13.5 }, height: { sdMinus2: 75.8, median: 81.7, sdPlus2: 87.6 }, bmi: { sdMinus2: 12.5, median: 14.8, sdPlus1: 16.2, sdPlus2: 17.3 } },
    /* 20m */ { weight: { sdMinus2: 8.4, median: 10.6, sdPlus2: 13.7 }, height: { sdMinus2: 76.7, median: 82.7, sdPlus2: 88.6 }, bmi: { sdMinus2: 12.5, median: 14.7, sdPlus1: 16.1, sdPlus2: 17.3 } },
    /* 21m */ { weight: { sdMinus2: 8.6, median: 10.9, sdPlus2: 14.0 }, height: { sdMinus2: 77.5, median: 83.7, sdPlus2: 89.7 }, bmi: { sdMinus2: 12.4, median: 14.7, sdPlus1: 16.0, sdPlus2: 17.2 } },
    /* 22m */ { weight: { sdMinus2: 8.7, median: 11.1, sdPlus2: 14.3 }, height: { sdMinus2: 78.4, median: 84.6, sdPlus2: 90.7 }, bmi: { sdMinus2: 12.4, median: 14.6, sdPlus1: 16.0, sdPlus2: 17.2 } },
    /* 23m */ { weight: { sdMinus2: 8.9, median: 11.3, sdPlus2: 14.5 }, height: { sdMinus2: 79.2, median: 85.5, sdPlus2: 91.7 }, bmi: { sdMinus2: 12.4, median: 14.6, sdPlus1: 15.9, sdPlus2: 17.2 } },
    /* 24m */ { weight: { sdMinus2: 9.0, median: 11.5, sdPlus2: 14.8 }, height: { sdMinus2: 80.0, median: 86.4, sdPlus2: 92.9 }, bmi: { sdMinus2: 12.4, median: 14.6, sdPlus1: 15.9, sdPlus2: 17.2 } },
    /* 25m */ { weight: { sdMinus2: 9.2, median: 11.7, sdPlus2: 15.1 }, height: { sdMinus2: 80.9, median: 87.3, sdPlus2: 93.9 }, bmi: { sdMinus2: 12.3, median: 14.5, sdPlus1: 15.8, sdPlus2: 17.1 } },
    /* 26m */ { weight: { sdMinus2: 9.4, median: 11.9, sdPlus2: 15.4 }, height: { sdMinus2: 81.7, median: 88.2, sdPlus2: 94.8 }, bmi: { sdMinus2: 12.3, median: 14.5, sdPlus1: 15.8, sdPlus2: 17.1 } },
    /* 27m */ { weight: { sdMinus2: 9.6, median: 12.2, sdPlus2: 15.7 }, height: { sdMinus2: 82.6, median: 89.1, sdPlus2: 95.7 }, bmi: { sdMinus2: 12.3, median: 14.5, sdPlus1: 15.8, sdPlus2: 17.1 } },
    /* 28m */ { weight: { sdMinus2: 9.8, median: 12.4, sdPlus2: 16.0 }, height: { sdMinus2: 83.4, median: 90.0, sdPlus2: 96.6 }, bmi: { sdMinus2: 12.3, median: 14.5, sdPlus1: 15.8, sdPlus2: 17.1 } },
    /* 29m */ { weight: { sdMinus2: 10.0, median: 12.7, sdPlus2: 16.3 }, height: { sdMinus2: 84.2, median: 90.8, sdPlus2: 97.5 }, bmi: { sdMinus2: 12.3, median: 14.4, sdPlus1: 15.7, sdPlus2: 17.0 } },
    /* 30m */ { weight: { sdMinus2: 10.2, median: 12.9, sdPlus2: 16.7 }, height: { sdMinus2: 85.0, median: 91.6, sdPlus2: 98.3 }, bmi: { sdMinus2: 12.3, median: 14.4, sdPlus1: 15.7, sdPlus2: 17.0 } },
    /* 31m */ { weight: { sdMinus2: 10.4, median: 13.1, sdPlus2: 17.0 }, height: { sdMinus2: 85.7, median: 92.4, sdPlus2: 99.1 }, bmi: { sdMinus2: 12.2, median: 14.4, sdPlus1: 15.7, sdPlus2: 17.0 } },
    /* 32m */ { weight: { sdMinus2: 10.5, median: 13.3, sdPlus2: 17.3 }, height: { sdMinus2: 86.4, median: 93.2, sdPlus2: 99.9 }, bmi: { sdMinus2: 12.2, median: 14.4, sdPlus1: 15.7, sdPlus2: 17.0 } },
    /* 33m */ { weight: { sdMinus2: 10.7, median: 13.6, sdPlus2: 17.6 }, height: { sdMinus2: 87.1, median: 93.9, sdPlus2: 100.8 }, bmi: { sdMinus2: 12.2, median: 14.4, sdPlus1: 15.7, sdPlus2: 17.0 } },
    /* 34m */ { weight: { sdMinus2: 10.9, median: 13.8, sdPlus2: 17.9 }, height: { sdMinus2: 87.8, median: 94.7, sdPlus2: 101.6 }, bmi: { sdMinus2: 12.2, median: 14.4, sdPlus1: 15.7, sdPlus2: 17.0 } },
    /* 35m */ { weight: { sdMinus2: 11.0, median: 14.0, sdPlus2: 18.2 }, height: { sdMinus2: 88.5, median: 95.4, sdPlus2: 102.3 }, bmi: { sdMinus2: 12.2, median: 14.4, sdPlus1: 15.7, sdPlus2: 17.0 } },
    /* 36m */ { weight: { sdMinus2: 11.2, median: 14.3, sdPlus2: 18.5 }, height: { sdMinus2: 89.1, median: 96.1, sdPlus2: 103.1 }, bmi: { sdMinus2: 12.2, median: 14.4, sdPlus1: 15.7, sdPlus2: 17.0 } }
  ];

  // Helper tra cứu chuẩn WHO cho trẻ em linh hoạt theo tháng (<= 36 tháng) hoặc theo năm (> 36 tháng)
  function getWhoChildRef(gender, totalMonths, metric) {
    const isFemale = gender === 'female';
    if (totalMonths <= 36) {
      const m = Math.min(36, Math.max(0, Math.round(totalMonths)));
      const table = isFemale ? WHO_MONTHS_GIRLS : WHO_MONTHS_BOYS;
      const ref = table[m] || table[0];
      if (metric === 'weight') return ref.weight;
      if (metric === 'height') return ref.height;
      return ref.bmi; // { sdMinus2, median, sdPlus1, sdPlus2 }
    } else {
      const ageYear = Math.min(18, Math.max(0, Math.round(totalMonths / 12)));
      if (metric === 'weight') {
        const t = isFemale ? WHO_WEIGHT_GIRLS : WHO_WEIGHT_BOYS;
        return t[ageYear] || t[10];
      }
      if (metric === 'height') {
        const t = isFemale ? WHO_HEIGHT_GIRLS : WHO_HEIGHT_BOYS;
        return t[ageYear] || t[10];
      }
      const t = isFemale ? WHO_BMI_GIRLS : WHO_BMI_BOYS;
      return t[ageYear] || t[10];
    }
  }

  // Dữ liệu ban đầu: để trống để ưu tiên đọc và đồng bộ dữ liệu thực tế từ Firebase Realtime Database
  const INITIAL_MEMBERS = [];
  const INITIAL_LOGS = [];

  // --- STATE QUẢN LÝ ---
  let state = {
    members: [],
    logs: [],
    currentTab: 'overview', // 'overview' | 'chart' | 'history' | 'calculator'
    selectedMemberIdForHistory: 'all',
    selectedMemberIdForChart: null,
    selectedMetricForChart: 'weight', // 'weight' | 'height' | 'bmi'
    activeEditingMemberId: null,
    editingLogId: null
  };

  // --- HÀM TÍNH TOÁN Y TẾ & THỜI GIAN ---

  // Tính tuổi (năm và tháng lẻ)
  function calculateAge(birthDateStr, targetDateStr) {
    const birth = new Date(birthDateStr);
    const target = targetDateStr ? new Date(targetDateStr) : new Date();

    let years = target.getFullYear() - birth.getFullYear();
    let months = target.getMonth() - birth.getMonth();
    let days = target.getDate() - birth.getDate();

    if (days < 0) {
      months--;
    }
    if (months < 0) {
      years--;
      months += 12;
    }

    const totalMonths = years * 12 + months;
    return {
      years: Math.max(0, years),
      months: Math.max(0, months),
      totalMonths: Math.max(0, totalMonths),
      isAdult: years >= 19
    };
  }

  // Định dạng hiển thị tuổi thân thiện
  function formatAgeLabel(birthDateStr, targetDateStr) {
    const age = calculateAge(birthDateStr, targetDateStr);
    if (age.years >= 19) {
      return `${age.years} tuổi`;
    }
    if (age.totalMonths <= 36) {
      if (age.totalMonths === 0) {
        return 'Sơ sinh';
      }
      return `${age.totalMonths} tháng tuổi`;
    }
    if (age.years === 0) {
      return `${age.months} tháng tuổi`;
    }
    return `${age.years} tuổi ${age.months > 0 ? age.months + ' tháng' : ''}`;
  }

  // Đánh giá và phân tích chỉ số sức khỏe theo chuẩn y tế (WHO Child Standards & WHO Asia-Pacific)
  function evaluateHealthStatus(heightCm, weightKg, birthDateStr, gender = 'male', targetDateStr) {
    const hM = heightCm / 100;
    const bmi = +(weightKg / (hM * hM)).toFixed(1);
    const age = calculateAge(birthDateStr, targetDateStr);

    // 1. Người trưởng thành (>= 19t) theo Chuẩn BMI Châu Á (WHO Asia-Pacific / Bộ Y Tế VN)
    if (age.isAdult) {
      const minIdeal = +(18.5 * hM * hM).toFixed(1);
      const maxIdeal = +(22.9 * hM * hM).toFixed(1);

      let status = 'normal';
      let statusLabel = 'Đạt chuẩn lý tưởng';
      let statusClass = 'fh-status-normal';
      let diffText = '';

      if (bmi < 18.5) {
        status = 'underweight';
        statusLabel = 'Thiếu cân (Gầy)';
        statusClass = 'fh-status-warning';
        const needGain = +(minIdeal - weightKg).toFixed(1);
        diffText = `Thấp hơn chuẩn ~${needGain} kg`;
      } else if (bmi >= 18.5 && bmi <= 22.9) {
        status = 'normal';
        statusLabel = 'Đạt chuẩn lý tưởng';
        statusClass = 'fh-status-normal';
        diffText = 'Thể trạng cân đối';
      } else if (bmi >= 23.0 && bmi <= 24.9) {
        status = 'overweight';
        statusLabel = 'Thừa cân nhẹ';
        statusClass = 'fh-status-caution';
        const needLose = +(weightKg - maxIdeal).toFixed(1);
        diffText = `Vượt chuẩn ~${needLose} kg`;
      } else {
        status = 'obese';
        statusLabel = bmi >= 30 ? 'Béo phì độ 2' : 'Béo phì độ 1';
        statusClass = 'fh-status-danger';
        const needLose = +(weightKg - maxIdeal).toFixed(1);
        diffText = `Vượt chuẩn ~${needLose} kg`;
      }

      return {
        bmi,
        status,
        statusLabel,
        statusClass,
        standardName: 'Chuẩn BMI Châu Á (WHO/WPRO)',
        idealWeightMin: minIdeal,
        idealWeightMax: maxIdeal,
        idealRangeText: `${minIdeal} - ${maxIdeal} kg`,
        diffText,
        isChild: false,
        isUnder36M: false
      };
    }

    // 2. Trẻ nhỏ (<= 36 tháng tuổi): Chuẩn WHO Tăng Trưởng Trẻ Em THEO TỪNG THÁNG TUỔI
    if (age.totalMonths <= 36) {
      const refWeight = getWhoChildRef(gender, age.totalMonths, 'weight');
      const refHeight = getWhoChildRef(gender, age.totalMonths, 'height');
      const refBmi = getWhoChildRef(gender, age.totalMonths, 'bmi');

      const minIdeal = refWeight.sdMinus2;
      const maxIdeal = refWeight.sdPlus2;
      const medianWeight = refWeight.median;

      let status = 'normal';
      let statusLabel = 'Đạt chuẩn WHO';
      let statusClass = 'fh-status-normal';
      let diffText = '';

      const weightDiff = +(weightKg - medianWeight).toFixed(1);

      if (weightKg < refWeight.sdMinus2) {
        status = 'underweight';
        statusLabel = 'Nhẹ cân / Thiếu cân';
        statusClass = 'fh-status-warning';
        const needGain = +(refWeight.sdMinus2 - weightKg).toFixed(1);
        diffText = `Thấp hơn chuẩn ~${needGain} kg`;
      } else if (weightKg > refWeight.sdPlus2) {
        status = 'overweight';
        statusLabel = 'Nguy cơ thừa cân';
        statusClass = 'fh-status-caution';
        const needLose = +(weightKg - refWeight.sdPlus2).toFixed(1);
        diffText = `Vượt chuẩn ~${needLose} kg`;
      } else {
        status = 'normal';
        statusLabel = 'Đạt chuẩn WHO';
        statusClass = 'fh-status-normal';
        diffText = weightDiff >= 0 ? `+${weightDiff} kg so với trung vị` : `${weightDiff} kg so với trung vị`;
      }

      const genderTitle = gender === 'female' ? 'Bé gái' : 'Bé trai';
      const ageTitle = age.totalMonths === 0 ? 'Sơ sinh' : `${age.totalMonths} tháng tuổi`;

      return {
        bmi,
        status,
        statusLabel,
        statusClass,
        standardName: `Chuẩn WHO Trẻ Em (${genderTitle} ${ageTitle})`,
        idealWeightMin: minIdeal,
        idealWeightMax: maxIdeal,
        idealRangeText: `${minIdeal} - ${maxIdeal} kg`,
        diffText,
        isChild: true,
        isUnder36M: true,
        months: age.totalMonths,
        refWeight,
        refHeight,
        refBmi
      };
    }

    // 3. Trẻ em & vị thành niên (3 tuổi - < 19 tuổi) theo Chuẩn Tăng Trưởng WHO (BMI-for-age)
    const refTable = gender === 'female' ? WHO_BMI_GIRLS : WHO_BMI_BOYS;
    const childAgeYear = Math.min(18, Math.max(3, age.years));
    const ref = refTable[childAgeYear] || refTable[10];

    const minIdeal = +(ref.sdMinus2 * hM * hM).toFixed(1);
    const maxIdeal = +(ref.sdPlus1 * hM * hM).toFixed(1);

    let status = 'normal';
    let statusLabel = 'Đạt chuẩn phát triển';
    let statusClass = 'fh-status-normal';
    let diffText = 'Phát triển chuẩn';

    if (bmi < ref.sdMinus2) {
      status = 'underweight';
      statusLabel = 'Thiếu cân / Nhẹ cân';
      statusClass = 'fh-status-warning';
      const needGain = +(minIdeal - weightKg).toFixed(1);
      diffText = `Thấp hơn chuẩn ~${needGain} kg`;
    } else if (bmi >= ref.sdMinus2 && bmi <= ref.sdPlus1) {
      status = 'normal';
      statusLabel = 'Đạt chuẩn WHO';
      statusClass = 'fh-status-normal';
      diffText = 'Chỉ số đạt chuẩn';
    } else if (bmi > ref.sdPlus1 && bmi <= ref.sdPlus2) {
      status = 'overweight';
      statusLabel = 'Nguy cơ thừa cân';
      statusClass = 'fh-status-caution';
      const needLose = +(weightKg - maxIdeal).toFixed(1);
      diffText = `Vượt chuẩn ~${needLose} kg`;
    } else {
      status = 'obese';
      statusLabel = 'Béo phì trẻ em';
      statusClass = 'fh-status-danger';
      const needLose = +(weightKg - maxIdeal).toFixed(1);
      diffText = `Vượt chuẩn ~${needLose} kg`;
    }

    return {
      bmi,
      status,
      statusLabel,
      statusClass,
      standardName: `Chuẩn WHO Trẻ Em (${gender === 'female' ? 'Bé gái' : 'Bé trai'} ${childAgeYear}t)`,
      idealWeightMin: minIdeal,
      idealWeightMax: maxIdeal,
      idealRangeText: `${minIdeal} - ${maxIdeal} kg`,
      diffText,
      isChild: true,
      isUnder36M: false
    };
  }

  // --- FIREBASE REALTIME DATABASE SYNC & LOCAL STORAGE ---
  let firebaseDbInstance = null;
  let activeProfileKey = 'default';
  let firebaseHealthMembersRef = null;
  let firebaseHealthLogsRef = null;
  let isFirebaseSyncReady = false;

  // Khởi tạo kết nối đồng bộ Firebase
  function initFamilyHealthFirebase(firebaseDb, profileKey) {
    if (!firebaseDb) return;
    firebaseDbInstance = firebaseDb;
    activeProfileKey = profileKey || 'default';

    // Hủy listeners cũ khi chuyển profile người dùng
    if (firebaseHealthMembersRef) {
      try { firebaseHealthMembersRef.off(); } catch (e) {}
    }
    if (firebaseHealthLogsRef) {
      try { firebaseHealthLogsRef.off(); } catch (e) {}
    }

    // Đọc cache từ LocalStorage trước để hiển thị tức thì không độ trễ
    loadData();

    firebaseHealthMembersRef = firebaseDb.ref(`familyHealth/${activeProfileKey}/members`);
    firebaseHealthLogsRef = firebaseDb.ref(`familyHealth/${activeProfileKey}/logs`);
    isFirebaseSyncReady = true;

    // 1. Lắng nghe real-time danh sách thành viên
    // 1. Lắng nghe real-time danh sách thành viên thực tế từ Firebase
    firebaseHealthMembersRef.on('value', (snapshot) => {
      const data = snapshot.val();
      if (data) {
        let membersList = Array.isArray(data) ? data : Object.values(data);
        // Loại bỏ hoàn toàn mem_baby nếu trước đây từng bị auto-inject vào Firebase
        membersList = membersList.filter(m => m && m.id !== 'mem_baby');
        state.members = membersList;
        // Dọn dẹp node mem_baby trên Firebase nếu còn lưu
        if (data.mem_baby || (Array.isArray(data) && data.some(m => m && m.id === 'mem_baby'))) {
          try { firebaseHealthMembersRef.child('mem_baby').remove(); } catch (e) {}
        }
      } else {
        state.members = [];
      }
      try {
        localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(state.members));
      } catch (e) {}
      renderIfModalActive();
    });

    // 2. Lắng nghe real-time danh sách số đo thực tế từ Firebase
    firebaseHealthLogsRef.on('value', (snapshot) => {
      const data = snapshot.val();
      if (data) {
        let logsList = Array.isArray(data) ? data : Object.values(data);
        // Loại bỏ logs của mem_baby nếu trước đây từng bị auto-inject
        logsList = logsList.filter(l => l && l.memberId !== 'mem_baby' && !String(l.id).startsWith('log_baby_'));
        state.logs = logsList;
        // Dọn dẹp logs của baby trên Firebase nếu có
        ['log_baby_0', 'log_baby_3', 'log_baby_6', 'log_baby_9', 'log_baby_12', 'log_baby_14'].forEach(id => {
          if (data[id]) {
            try { firebaseHealthLogsRef.child(id).remove(); } catch (e) {}
          }
        });
      } else {
        state.logs = [];
      }
      try {
        localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(state.logs));
      } catch (e) {}
      renderIfModalActive();
    });
  }

  function renderIfModalActive() {
    const modal = document.getElementById('familyHealthModal');
    if (modal && modal.style.display !== 'none') {
      renderCurrentTab();
    }
  }

  function saveMembersToFirebase() {
    if (!firebaseHealthMembersRef) return;
    const map = {};
    state.members.forEach(m => {
      if (m && m.id) map[m.id] = m;
    });
    firebaseHealthMembersRef.set(map).then(() => {
      if (typeof window.showCloudSyncedBadge === 'function') {
        window.showCloudSyncedBadge();
      }
    }).catch(err => {
      console.warn('[FamilyHealth] Lỗi lưu Firebase members:', err);
    });
  }

  function saveLogsToFirebase() {
    if (!firebaseHealthLogsRef) return;
    const map = {};
    state.logs.forEach(l => {
      if (l && l.id) map[l.id] = l;
    });
    firebaseHealthLogsRef.set(map).then(() => {
      if (typeof window.showCloudSyncedBadge === 'function') {
        window.showCloudSyncedBadge();
      }
    }).catch(err => {
      console.warn('[FamilyHealth] Lỗi lưu Firebase logs:', err);
    });
  }

  function loadData() {
    try {
      const storedMembers = localStorage.getItem(STORAGE_KEYS.MEMBERS);
      const storedLogs = localStorage.getItem(STORAGE_KEYS.LOGS);

      if (storedMembers) {
        const parsed = JSON.parse(storedMembers);
        if (Array.isArray(parsed)) {
          state.members = parsed.filter(m => m && m.id !== 'mem_baby');
        } else {
          state.members = [];
        }
      } else {
        state.members = [];
      }

      if (storedLogs) {
        const parsed = JSON.parse(storedLogs);
        if (Array.isArray(parsed)) {
          state.logs = parsed.filter(l => l && l.memberId !== 'mem_baby' && !String(l.id).startsWith('log_baby_'));
        } else {
          state.logs = [];
        }
      } else {
        state.logs = [];
      }
    } catch (e) {
      console.warn('[FamilyHealth] Lỗi đọc localStorage:', e);
      state.members = [];
      state.logs = [];
    }
  }

  function saveMembers() {
    try {
      localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(state.members));
    } catch (e) {
      console.error('[FamilyHealth] Lỗi lưu thành viên:', e);
    }
    saveMembersToFirebase();
  }

  function saveLogs() {
    try {
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(state.logs));
    } catch (e) {
      console.error('[FamilyHealth] Lỗi lưu số đo:', e);
    }
    saveLogsToFirebase();
  }

  function deleteMember(memberId) {
    const target = state.members.find(m => m.id === memberId);
    const targetName = target ? target.name : 'thành viên này';
    if (!confirm(`Bạn có chắc muốn xóa "${targetName}" và toàn bộ lịch sử đo của họ?`)) return;

    state.members = state.members.filter(m => m.id !== memberId);
    state.logs = state.logs.filter(l => l.memberId !== memberId);
    saveMembers();
    saveLogs();
    renderCurrentTab();
  }

  // Lấy số đo mới nhất của 1 thành viên
  function getLatestLog(memberId) {
    const memberLogs = state.logs
      .filter(l => l.memberId === memberId)
      .sort((a, b) => new Date(b.measuredDate) - new Date(a.measuredDate));
    return memberLogs[0] || null;
  }

  // Lấy số đo gần thứ 2 (để so sánh đà tăng giảm)
  function getPreviousLog(memberId) {
    const memberLogs = state.logs
      .filter(l => l.memberId === memberId)
      .sort((a, b) => new Date(b.measuredDate) - new Date(a.measuredDate));
    return memberLogs[1] || null;
  }

  // Định dạng ngày Việt Nam
  function formatDateVi(dateStr) {
    if (!dateStr) return '';
    try {
      const [y, m, d] = dateStr.split('-');
      return `${d}/${m}/${y}`;
    } catch (e) {
      return dateStr;
    }
  }

  // --- RENDER GIAO DIỆN CHÍNH ---

  // 1. Tab 1: Tổng quan gia đình (Overview)
  function renderOverviewTab() {
    const container = document.getElementById('fhTabContent');
    if (!container) return;

    if (state.members.length === 0) {
      container.innerHTML = `
        <div class="fh-empty-state">
          <div class="fh-empty-icon"><i class="fi fi-rr-users-alt"></i></div>
          <h4 class="fh-empty-title">Chưa có thành viên nào</h4>
          <p class="fh-empty-desc">Hãy thêm các thành viên trong gia đình để bắt đầu theo dõi sức khỏe và thể trạng đạt chuẩn!</p>
          <button type="button" class="fh-btn fh-btn-primary" onclick="window.fhOpenAddMemberModal()">
            <i class="fi fi-rr-user-add"></i> <span>Thêm Thành Viên Đầu Tiên</span>
          </button>
        </div>
      `;
      return;
    }

    // Thống kê nhanh
    let normalCount = 0;
    let warningCount = 0;
    let totalMeasured = 0;

    const cardsHtml = state.members.map(member => {
      const latest = getLatestLog(member.id);
      const prev = getPreviousLog(member.id);
      const ageLabel = formatAgeLabel(member.birthDate, latest ? latest.measuredDate : null);

      if (!latest) {
        return `
          <div class="fh-member-card">
            <div class="fh-card-header">
              <div class="fh-member-avatar" style="background: ${member.avatarColor || 'linear-gradient(135deg, #10b981, #059669)'}">
                <i class="fi ${member.avatarIcon || 'fi-rr-user'}"></i>
              </div>
              <div class="fh-member-meta">
                <div class="fh-member-name-row">
                  <h4 class="fh-member-name">${escapeHtml(member.name)}</h4>
                  <span class="fh-member-role-badge">${escapeHtml(member.role)}</span>
                </div>
                <div class="fh-member-age">
                  <i class="fi fi-rr-calendar"></i> ${ageLabel} • ${member.gender === 'female' ? 'Nữ' : 'Nam'}
                </div>
              </div>
              <div class="fh-card-actions-dropdown">
                <button type="button" class="fh-icon-btn" onclick="window.fhEditMember('${member.id}')" title="Sửa thông tin">
                  <i class="fi fi-rr-edit"></i>
                </button>
                <button type="button" class="fh-icon-btn fh-icon-btn-danger" onclick="window.fhDeleteMember('${member.id}')" title="Xóa thành viên">
                  <i class="fi fi-rr-trash"></i>
                </button>
              </div>
            </div>

            <div class="fh-card-no-data">
              <i class="fi fi-rr-dashboard"></i>
              <span>Chưa có dữ liệu đo chiều cao & cân nặng</span>
            </div>

            <div class="fh-card-footer">
              <button type="button" class="fh-btn fh-btn-secondary fh-btn-sm" onclick="window.fhOpenAddLogModal('${member.id}')">
                <i class="fi fi-rr-plus"></i> <span>Ghi số đo đầu tiên</span>
              </button>
            </div>
          </div>
        `;
      }

      totalMeasured++;
      const evalData = evaluateHealthStatus(
        latest.heightCm,
        latest.weightKg,
        member.birthDate,
        member.gender,
        latest.measuredDate
      );

      if (evalData.status === 'normal') {
        normalCount++;
      } else {
        warningCount++;
      }

      // Đà thay đổi so với lần đo trước
      let trendWeightHtml = '';
      if (prev) {
        const diffW = +(latest.weightKg - prev.weightKg).toFixed(1);
        if (diffW > 0) {
          trendWeightHtml = `<span class="fh-trend fh-trend-up" title="Tăng ${diffW}kg so với ngày ${formatDateVi(prev.measuredDate)}"><i class="fi fi-rr-arrow-small-up"></i> +${diffW} kg</span>`;
        } else if (diffW < 0) {
          trendWeightHtml = `<span class="fh-trend fh-trend-down" title="Giảm ${Math.abs(diffW)}kg so với ngày ${formatDateVi(prev.measuredDate)}"><i class="fi fi-rr-arrow-small-down"></i> ${diffW} kg</span>`;
        } else {
          trendWeightHtml = `<span class="fh-trend fh-trend-neutral" title="Không đổi"><i class="fi fi-rr-minus"></i> 0 kg</span>`;
        }
      }

      return `
        <div class="fh-member-card">
          <!-- Card Header -->
          <div class="fh-card-header">
            <div class="fh-member-avatar" style="background: ${member.avatarColor || 'linear-gradient(135deg, #10b981, #059669)'}">
              <i class="fi ${member.avatarIcon || 'fi-rr-user'}"></i>
            </div>
            <div class="fh-member-meta">
              <div class="fh-member-name-row">
                <h4 class="fh-member-name">${escapeHtml(member.name)}</h4>
                <span class="fh-member-role-badge">${escapeHtml(member.role)}</span>
              </div>
              <div class="fh-member-age">
                <i class="fi fi-rr-calendar"></i> <span>${ageLabel} • ${member.gender === 'female' ? 'Nữ' : 'Nam'}</span>
              </div>
            </div>
            <div class="fh-card-actions-dropdown">
              <button type="button" class="fh-icon-btn" onclick="window.fhEditMember('${member.id}')" title="Sửa thông tin hồ sơ">
                <i class="fi fi-rr-edit"></i>
              </button>
              <button type="button" class="fh-icon-btn fh-icon-btn-danger" onclick="window.fhDeleteMember('${member.id}')" title="Xóa thành viên">
                <i class="fi fi-rr-trash"></i>
              </button>
            </div>
          </div>

          <!-- Status Pill Badge -->
          <div class="fh-status-banner ${evalData.statusClass}">
            <div class="fh-status-left">
              <i class="fi ${evalData.status === 'normal' ? 'fi-rr-check-circle' : 'fi-rr-info'}"></i>
              <span>${evalData.statusLabel}</span>
            </div>
            <span class="fh-status-diff-pill">${evalData.diffText}</span>
          </div>

          <!-- Metrics Grid -->
          <div class="fh-metrics-grid">
            <div class="fh-metric-box">
              <span class="fh-metric-label">Cân nặng</span>
              <div class="fh-metric-val-row">
                <span class="fh-metric-val">${latest.weightKg}</span>
                <span class="fh-metric-unit">kg</span>
              </div>
              ${trendWeightHtml}
            </div>

            <div class="fh-metric-box">
              <span class="fh-metric-label">Chiều cao</span>
              <div class="fh-metric-val-row">
                <span class="fh-metric-val">${latest.heightCm}</span>
                <span class="fh-metric-unit">cm</span>
              </div>
              <span class="fh-metric-sub">Đo ${formatDateVi(latest.measuredDate)}</span>
            </div>

            <div class="fh-metric-box">
              <span class="fh-metric-label">Chỉ số BMI</span>
              <div class="fh-metric-val-row">
                <span class="fh-metric-val ${evalData.statusClass}-text">${evalData.bmi}</span>
              </div>
              <span class="fh-metric-sub">${evalData.isUnder36M ? 'Chuẩn WHO tháng' : (evalData.isChild ? 'Theo tuổi WHO' : 'Chuẩn Châu Á')}</span>
            </div>
          </div>

          <!-- Dải cân nặng chuẩn tham chiếu -->
          <div class="fh-card-target-bar">
            <div class="fh-target-indicator">
              <i class="fi fi-rr-target"></i>
              <span>${evalData.isUnder36M ? 'Cân nặng chuẩn WHO tháng:' : 'Dải cân nặng đạt chuẩn:'} <strong>${evalData.idealRangeText}</strong></span>
            </div>
          </div>

          <!-- Card Footer Actions -->
          <div class="fh-card-footer">
            <button type="button" class="fh-btn fh-btn-secondary fh-btn-sm" onclick="window.fhViewMemberChart('${member.id}')" title="Xem biểu đồ tăng trưởng so với chuẩn WHO">
              <i class="fi fi-rr-chart-line-up"></i> <span>Biểu Đồ</span>
            </button>
            <button type="button" class="fh-btn fh-btn-secondary fh-btn-sm" onclick="window.fhViewMemberHistory('${member.id}')">
              <i class="fi fi-rr-time-past"></i> <span>Lịch Sử</span>
            </button>
            <button type="button" class="fh-btn fh-btn-primary fh-btn-sm" onclick="window.fhOpenAddLogModal('${member.id}')">
              <i class="fi fi-rr-plus"></i> <span>Đo Mới</span>
            </button>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <!-- Family Overview Top Stats -->
      <div class="fh-overview-hero">
        <div class="fh-hero-stat-card">
          <div class="fh-hero-stat-icon" style="background: rgba(16, 185, 129, 0.15); color: #10b981;">
            <i class="fi fi-rr-users-alt"></i>
          </div>
          <div class="fh-hero-stat-info">
            <span class="fh-hero-stat-title">Tổng quan</span>
            <span class="fh-hero-stat-value">${state.members.length} <small>người</small></span>
          </div>
        </div>

        <div class="fh-hero-stat-card">
          <div class="fh-hero-stat-icon" style="background: rgba(16, 185, 129, 0.2); color: #10b981;">
            <i class="fi fi-rr-check"></i>
          </div>
          <div class="fh-hero-stat-info">
            <span class="fh-hero-stat-title">Đạt chuẩn</span>
            <span class="fh-hero-stat-value" style="color: #10b981;">${normalCount} <small>/ ${totalMeasured} đã đo</small></span>
          </div>
        </div>

        <div class="fh-hero-stat-card">
          <div class="fh-hero-stat-icon" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b;">
            <i class="fi fi-rr-shield-exclamation"></i>
          </div>
          <div class="fh-hero-stat-info">
            <span class="fh-hero-stat-title">Cần cải thiện</span>
            <span class="fh-hero-stat-value" style="color: #f59e0b;">${warningCount} <small>người</small></span>
          </div>
        </div>
      </div>

      <!-- Member Cards Grid -->
      <div class="fh-members-grid">
        ${cardsHtml}
      </div>
    `;
  }

  // 2. Tab: Biểu Đồ Tăng Trưởng & So Sánh Chuẩn Y Tế (Growth & Health Standard Chart)
  function renderChartTab() {
    const container = document.getElementById('fhTabContent');
    if (!container) return;

    if (state.members.length === 0) {
      container.innerHTML = `
        <div class="fh-empty-state">
          <div class="fh-empty-icon"><i class="fi fi-rr-chart-line-up"></i></div>
          <h4 class="fh-empty-title">Chưa có thành viên nào</h4>
          <p class="fh-empty-desc">Vui lòng thêm thành viên gia đình để bắt đầu vẽ biểu đồ tăng trưởng chuẩn WHO!</p>
          <button type="button" class="fh-btn fh-btn-primary" onclick="window.fhOpenAddMemberModal()">
            <i class="fi fi-rr-user-add"></i> <span>Thêm Thành Viên Ngay</span>
          </button>
        </div>
      `;
      return;
    }

    // Xác định thành viên được chọn
    let currentMember = state.members.find(m => m.id === state.selectedMemberIdForChart);
    if (!currentMember) {
      currentMember = state.members[0];
      state.selectedMemberIdForChart = currentMember.id;
    }

    const currentAge = calculateAge(currentMember.birthDate);
    const isChild = currentAge.years < 19;
    const metric = state.selectedMetricForChart || 'weight'; // 'weight' | 'height' | 'bmi'

    // Lấy tất cả số đo của thành viên này, sắp xếp tăng dần theo ngày đo
    const memberLogs = state.logs
      .filter(l => l.memberId === currentMember.id)
      .sort((a, b) => new Date(a.measuredDate) - new Date(b.measuredDate));

    // 1. Render Member Selector Pills
    const memberSelectorHtml = state.members.map(m => {
      const isSelected = m.id === currentMember.id;
      const mAge = calculateAge(m.birthDate);
      const mAgeLabel = mAge.years < 19 ? `${mAge.years} tuổi` : `${mAge.years}t`;
      return `
        <button type="button" 
          class="fh-chart-member-pill ${isSelected ? 'active' : ''}" 
          onclick="window.fhOnChartMemberChange('${m.id}')">
          <div class="fh-cmp-avatar" style="background: ${m.avatarColor || 'linear-gradient(135deg, #10b981, #059669)'}">
            <i class="fi ${m.avatarIcon || 'fi-rr-user'}"></i>
          </div>
          <div class="fh-cmp-info">
            <span class="fh-cmp-name">${escapeHtml(m.name)}</span>
            <span class="fh-cmp-sub">${escapeHtml(m.role)} • ${mAgeLabel}</span>
          </div>
        </button>
      `;
    }).join('');

    // 2. Render Metric Switcher Buttons
    const metricButtonsHtml = `
      <div class="fh-chart-metric-bar">
        <button type="button" 
          class="fh-chart-metric-btn ${metric === 'weight' ? 'active' : ''}" 
          onclick="window.fhOnChartMetricChange('weight')">
          <i class="fi fi-rr-scale"></i>
          <span>Cân nặng (kg)</span>
        </button>
        <button type="button" 
          class="fh-chart-metric-btn ${metric === 'height' ? 'active' : ''}" 
          onclick="window.fhOnChartMetricChange('height')">
          <i class="fi fi-rr-ruler-triangle"></i>
          <span>Chiều cao (cm)</span>
        </button>
        <button type="button" 
          class="fh-chart-metric-btn ${metric === 'bmi' ? 'active' : ''}" 
          onclick="window.fhOnChartMetricChange('bmi')">
          <i class="fi fi-rr-dashboard"></i>
          <span>Chỉ số BMI</span>
        </button>
      </div>
    `;

    // 3. Chuẩn bị dữ liệu vẽ SVG
    let chartContentHtml = '';
    let insightCardHtml = '';

    if (memberLogs.length === 0) {
      chartContentHtml = `
        <div class="fh-chart-empty-state">
          <div class="fh-chart-empty-icon"><i class="fi fi-rr-chart-pie-alt"></i></div>
          <h4 class="fh-chart-empty-title">Chưa có số đo nào cho ${escapeHtml(currentMember.name)}</h4>
          <p class="fh-chart-empty-desc">Ghi lại lần đo cân nặng & chiều cao đầu tiên để hệ thống vẽ biểu đồ so sánh với bảng chuẩn y tế!</p>
          <button type="button" class="fh-btn fh-btn-primary" onclick="window.fhOpenAddLogModal('${currentMember.id}')">
            <i class="fi fi-rr-plus"></i> <span>Ghi Số Đo Đầu Tiên</span>
          </button>
        </div>
      `;
    } else {
      // Xác định bé có thuộc nhóm dưới 36 tháng tuổi không
      const isBabyUnder36M = isChild && currentAge.totalMonths <= 36;

      // Tính toán các mốc đo và giá trị chuẩn tương ứng
      const points = memberLogs.map((log) => {
        const logAge = calculateAge(currentMember.birthDate, log.measuredDate);
        const isPointUnder36M = logAge.totalMonths <= 36;

        let val = 0;
        let refMin = 0;
        let refMedian = 0;
        let refMax = 0;
        let unit = '';
        let metricLabel = '';

        if (metric === 'weight') {
          val = log.weightKg;
          unit = ' kg';
          metricLabel = 'Cân nặng';
          if (isPointUnder36M) {
            const ref = getWhoChildRef(currentMember.gender, logAge.totalMonths, 'weight');
            refMin = ref.sdMinus2;
            refMedian = ref.median;
            refMax = ref.sdPlus2;
          } else if (isChild) {
            const roundAge = Math.min(18, Math.max(0, Math.round(logAge.years + logAge.months / 12)));
            const refTable = currentMember.gender === 'female' ? WHO_WEIGHT_GIRLS : WHO_WEIGHT_BOYS;
            const ref = refTable[roundAge] || refTable[10];
            refMin = ref.sdMinus2;
            refMedian = ref.median;
            refMax = ref.sdPlus2;
          } else {
            const hM = log.heightCm / 100;
            refMin = +(18.5 * hM * hM).toFixed(1);
            refMedian = +(20.7 * hM * hM).toFixed(1);
            refMax = +(22.9 * hM * hM).toFixed(1);
          }
        } else if (metric === 'height') {
          val = log.heightCm;
          unit = ' cm';
          metricLabel = 'Chiều cao';
          if (isPointUnder36M) {
            const ref = getWhoChildRef(currentMember.gender, logAge.totalMonths, 'height');
            refMin = ref.sdMinus2;
            refMedian = ref.median;
            refMax = ref.sdPlus2;
          } else if (isChild) {
            const roundAge = Math.min(18, Math.max(0, Math.round(logAge.years + logAge.months / 12)));
            const refTable = currentMember.gender === 'female' ? WHO_HEIGHT_GIRLS : WHO_HEIGHT_BOYS;
            const ref = refTable[roundAge] || refTable[10];
            refMin = ref.sdMinus2;
            refMedian = ref.median;
            refMax = ref.sdPlus2;
          } else {
            refMin = +(log.heightCm - 1).toFixed(1);
            refMedian = +(log.heightCm).toFixed(1);
            refMax = +(log.heightCm + 1).toFixed(1);
          }
        } else { // 'bmi'
          val = calculateBMI(log.weightKg, log.heightCm);
          unit = '';
          metricLabel = 'Chỉ số BMI';
          if (isPointUnder36M) {
            const ref = getWhoChildRef(currentMember.gender, logAge.totalMonths, 'bmi');
            refMin = ref.sdMinus2;
            refMedian = ref.median;
            refMax = ref.sdPlus1; // Vùng an toàn đạt chuẩn WHO
          } else if (isChild) {
            const roundAge = Math.min(18, Math.max(0, Math.round(logAge.years + logAge.months / 12)));
            const refTable = currentMember.gender === 'female' ? WHO_BMI_GIRLS : WHO_BMI_BOYS;
            const ref = refTable[roundAge] || refTable[10];
            refMin = ref.sdMinus2;
            refMedian = ref.median;
            refMax = ref.sdPlus1; // Vùng an toàn đạt chuẩn WHO
          } else {
            refMin = 18.5;
            refMedian = 20.7;
            refMax = 22.9;
          }
        }

        // Đánh giá trạng thái
        let diff = +(val - refMedian).toFixed(1);
        let statusBadge = 'Đạt chuẩn';
        let statusClass = 'fh-status-normal';
        if (val < refMin) {
          statusBadge = metric === 'height' ? 'Thấp còi' : 'Thiếu cân';
          statusClass = 'fh-status-warning';
        } else if (val > refMax) {
          statusBadge = metric === 'height' ? 'Vượt chuẩn (+2SD)' : (isChild ? 'Nguy cơ thừa cân' : 'Thừa cân');
          statusClass = metric === 'height' ? 'fh-status-normal' : 'fh-status-caution';
        }

        // Nhãn tuổi hiển thị dưới từng điểm mốc
        let pointAgeLabel = '';
        if (isPointUnder36M) {
          pointAgeLabel = logAge.totalMonths === 0 ? 'Sơ sinh' : `${logAge.totalMonths} tháng`;
        } else if (isChild) {
          pointAgeLabel = `${logAge.years} tuổi ${logAge.months > 0 ? logAge.months + 'th' : ''}`;
        } else {
          pointAgeLabel = `${logAge.years} tuổi`;
        }

        return {
          logId: log.id,
          dateVi: formatDateVi(log.measuredDate),
          dateStr: log.measuredDate,
          ageLabel: pointAgeLabel,
          val,
          unit,
          metricLabel,
          refMin,
          refMedian,
          refMax,
          diff,
          statusBadge,
          statusClass,
          notes: log.notes || ''
        };
      });

      // SVG Dimensions
      const svgW = 760;
      const svgH = 320;
      const padLeft = 55;
      const padRight = 35;
      const padTop = 38;
      const padBottom = 48;
      const plotW = svgW - padLeft - padRight;
      const plotH = svgH - padTop - padBottom;

      // Tìm dải Min/Max cho trục Y
      const allValues = [];
      points.forEach(p => {
        allValues.push(p.val, p.refMin, p.refMedian, p.refMax);
      });
      const dataMin = Math.min(...allValues);
      const dataMax = Math.max(...allValues);
      const valSpan = (dataMax - dataMin) || 4;
      const yMin = Math.floor(Math.max(0, dataMin - valSpan * 0.15));
      const yMax = Math.ceil(dataMax + valSpan * 0.15);
      const yRange = (yMax - yMin) || 1;

      function mapY(v) {
        return +(padTop + plotH - ((v - yMin) / yRange) * plotH).toFixed(1);
      }

      function mapX(index, total) {
        if (total <= 1) return +(padLeft + plotW / 2).toFixed(1);
        return +(padLeft + (index / (total - 1)) * plotW).toFixed(1);
      }

      // 1. Gridlines Y (5 vạch)
      let gridlinesHtml = '';
      const gridSteps = 4;
      for (let i = 0; i <= gridSteps; i++) {
        const gridVal = +(yMin + (yRange / gridSteps) * i).toFixed(1);
        const yPos = mapY(gridVal);
        gridlinesHtml += `
          <g class="fh-svg-grid-row">
            <line x1="${padLeft}" y1="${yPos}" x2="${padLeft + plotW}" y2="${yPos}" stroke="rgba(255, 255, 255, 0.08)" stroke-width="1" stroke-dasharray="3,3" />
            <text x="${padLeft - 10}" y="${yPos + 4}" text-anchor="end" fill="#64748b" font-size="11" font-family="'Be Vietnam Pro', sans-serif">${gridVal}</text>
          </g>
        `;
      }

      // 2. Dải vùng chuẩn (Standard Area / Corridor)
      let standardBandHtml = '';
      let medianLineHtml = '';
      const N = points.length;

      if (N === 1) {
        const yTop = mapY(points[0].refMax);
        const yBot = mapY(points[0].refMin);
        const bandH = Math.max(2, yBot - yTop);
        standardBandHtml = `
          <rect x="${padLeft}" y="${yTop}" width="${plotW}" height="${bandH}" 
            fill="url(#fhStdGrad)" stroke="rgba(16, 185, 129, 0.35)" stroke-width="1" stroke-dasharray="4,4" rx="4" />
        `;
        const yMed = mapY(points[0].refMedian);
        medianLineHtml = `
          <line x1="${padLeft}" y1="${yMed}" x2="${padLeft + plotW}" y2="${yMed}" 
            stroke="#10b981" stroke-width="2" stroke-dasharray="6,4" opacity="0.9" />
        `;
      } else {
        // Dải vùng chuẩn đa giác nối từ mốc 0 đến N-1
        const topPoints = points.map((p, i) => `${mapX(i, N)},${mapY(p.refMax)}`).join(' L ');
        const botPoints = points.slice().reverse().map((p, i) => `${mapX(N - 1 - i, N)},${mapY(p.refMin)}`).join(' L ');
        const pathD = `M ${topPoints} L ${botPoints} Z`;
        standardBandHtml = `
          <path d="${pathD}" fill="url(#fhStdGrad)" stroke="rgba(16, 185, 129, 0.35)" stroke-width="1.2" stroke-dasharray="4,3" />
        `;

        // Đường trung vị chuẩn
        const medianD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${mapX(i, N)},${mapY(p.refMedian)}`).join(' ');
        medianLineHtml = `
          <path d="${medianD}" fill="none" stroke="#10b981" stroke-width="2" stroke-dasharray="6,4" stroke-linecap="round" opacity="0.9" />
        `;
      }

      // 3. Đường thực tế (Actual Curve)
      let actualLineHtml = '';
      if (N > 1) {
        const actualD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${mapX(i, N)},${mapY(p.val)}`).join(' ');
        actualLineHtml = `
          <path d="${actualD}" fill="none" stroke="url(#fhActualGrad)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" class="fh-svg-actual-line" />
        `;
      }

      // 4. Các điểm mốc đo (Data Points) & nhãn giá trị
      let pointsHtml = '';
      points.forEach((p, idx) => {
        const cx = mapX(idx, N);
        const cy = mapY(p.val);
        const isLatest = idx === N - 1;

        pointsHtml += `
          <g class="fh-svg-point-group" tabindex="0">
            <!-- Vùng tương tác mở rộng -->
            <circle cx="${cx}" cy="${cy}" r="16" fill="transparent" style="cursor: pointer;" />
            <!-- Vòng hào quang nếu là điểm mới nhất -->
            ${isLatest ? `<circle cx="${cx}" cy="${cy}" r="11" fill="rgba(56, 189, 248, 0.25)" />` : ''}
            <!-- Điểm chính -->
            <circle cx="${cx}" cy="${cy}" r="${isLatest ? '6.5' : '5.5'}" fill="#0284c7" stroke="#ffffff" stroke-width="2.5" class="fh-svg-point-dot" />
            <!-- Giá trị số đo ngay trên điểm -->
            <text x="${cx}" y="${cy - 12}" text-anchor="middle" fill="#38bdf8" font-size="12" font-weight="700" font-family="'Be Vietnam Pro', sans-serif">
              ${p.val}${p.unit}
            </text>
            <!-- Nhãn ngày đo & tuổi bên dưới trục X -->
            <text x="${cx}" y="${padTop + plotH + 20}" text-anchor="middle" fill="#e2e8f0" font-size="11" font-weight="600" font-family="'Be Vietnam Pro', sans-serif">
              ${p.dateVi}
            </text>
            <text x="${cx}" y="${padTop + plotH + 34}" text-anchor="middle" fill="#94a3b8" font-size="10" font-family="'Be Vietnam Pro', sans-serif">
              ${p.ageLabel}
            </text>
          </g>
        `;
      });

      // Tạo SVG hoàn chỉnh
      const svgChartHtml = `
        <div class="fh-svg-chart-wrapper">
          <svg viewBox="0 0 ${svgW} ${svgH}" class="fh-svg-chart" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <!-- Gradient cho dải chuẩn WHO / Chuẩn Châu Á -->
              <linearGradient id="fhStdGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#10b981" stop-opacity="0.22" />
                <stop offset="100%" stop-color="#10b981" stop-opacity="0.06" />
              </linearGradient>
              <!-- Gradient cho đường thực tế -->
              <linearGradient id="fhActualGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stop-color="#0284c7" />
                <stop offset="100%" stop-color="#38bdf8" />
              </linearGradient>
            </defs>

            <!-- Lưới trục Y -->
            ${gridlinesHtml}

            <!-- Dải vùng chuẩn đạt chuẩn -->
            ${standardBandHtml}

            <!-- Đường trung vị chuẩn (Median) -->
            ${medianLineHtml}

            <!-- Đường thực tế -->
            ${actualLineHtml}

            <!-- Các điểm mốc đo và nhãn -->
            ${pointsHtml}
          </svg>
        </div>
      `;

      // 4. Phân tích Xu Hướng & Lời Khuyên (Growth Insights)
      const latestPoint = points[points.length - 1];
      const firstPoint = points[0];
      const genderText = currentMember.gender === 'female' ? 'Bé gái' : 'Bé trai';
      const standardTitle = isBabyUnder36M
        ? `Chuẩn Tăng Trưởng WHO (${genderText} ${currentAge.totalMonths === 0 ? 'Sơ sinh' : currentAge.totalMonths + ' tháng tuổi'})`
        : (isChild
          ? `Chuẩn Tăng Trưởng Trẻ Em WHO (${genderText} ${currentAge.years} tuổi)`
          : `Chuẩn Thể Trạng Người Lớn Châu Á (IDI & WPRO)`);

      let trendAnalysisText = '';
      if (points.length > 1) {
        const totalChange = +(latestPoint.val - firstPoint.val).toFixed(1);
        const changeSign = totalChange > 0 ? `+${totalChange}` : `${totalChange}`;
        if (metric === 'height') {
          trendAnalysisText = `Từ ngày ${firstPoint.dateVi} đến nay, chiều cao đã tăng <strong>${changeSign} cm</strong> (từ ${firstPoint.val}cm lên ${latestPoint.val}cm). ${isChild ? 'Tốc độ tăng trưởng xương rất tích cực!' : 'Thể trạng chiều cao ổn định.'}`;
        } else if (metric === 'weight') {
          trendAnalysisText = `Từ ngày ${firstPoint.dateVi} đến nay, cân nặng biến chuyển <strong>${changeSign} kg</strong> (từ ${firstPoint.val}kg sang ${latestPoint.val}kg). Điểm đo mới nhất bám sát dải chuẩn của chuyên gia.`;
        } else {
          trendAnalysisText = `Chỉ số BMI có sự thay đổi từ ${firstPoint.val} sang ${latestPoint.val} (${changeSign}). ${latestPoint.statusBadge === 'Đạt chuẩn' ? 'Hiện tại đang duy trì trong vùng thể trạng khỏe mạnh lý tưởng!' : 'Cần chú ý điều chỉnh nhẹ khẩu phần.'}`;
        }
      } else {
        trendAnalysisText = `Ghi nhận lần đo đầu tiên vào ngày ${latestPoint.dateVi}: ${latestPoint.metricLabel} đạt <strong>${latestPoint.val}${latestPoint.unit}</strong>. Bạn hãy duy trì thói quen ghi số đo định kỳ để theo dõi đường cong tăng trưởng liên tục!`;
      }

      insightCardHtml = `
        <!-- Chi tiết lần đo gần nhất -->
        <div class="fh-chart-detail-card">
          <div class="fh-cdc-header">
            <div class="fh-cdc-title-box">
              <i class="fi fi-rr-calendar-check" style="color: #38bdf8;"></i>
              <span>Lần đo gần nhất: <strong>${latestPoint.dateVi}</strong> (${latestPoint.ageLabel})</span>
            </div>
            <span class="fh-status-tag ${latestPoint.statusClass}">${latestPoint.statusBadge}</span>
          </div>

          <div class="fh-cdc-metrics-grid">
            <div class="fh-cdc-item">
              <span class="fh-cdc-lbl">Thực tế đo được</span>
              <span class="fh-cdc-val" style="color: #38bdf8;">${latestPoint.val} <small>${latestPoint.unit}</small></span>
            </div>
            <div class="fh-cdc-item">
              <span class="fh-cdc-lbl">Dải đạt chuẩn ${isChild ? 'WHO' : 'lý tưởng'}</span>
              <span class="fh-cdc-val" style="color: #10b981;">${latestPoint.refMin} - ${latestPoint.refMax} <small>${latestPoint.unit}</small></span>
            </div>
            <div class="fh-cdc-item">
              <span class="fh-cdc-lbl">Chuẩn trung vị (Median)</span>
              <span class="fh-cdc-val" style="color: #34d399;">${latestPoint.refMedian} <small>${latestPoint.unit}</small></span>
            </div>
            <div class="fh-cdc-item">
              <span class="fh-cdc-lbl">So với trung vị</span>
              <span class="fh-cdc-val ${latestPoint.diff >= 0 ? 'text-emerald-400' : 'text-sky-400'}">
                ${latestPoint.diff > 0 ? `+${latestPoint.diff}` : `${latestPoint.diff}`} <small>${latestPoint.unit}</small>
              </span>
            </div>
          </div>
        </div>

        <!-- Hộp Phân Tích Biến Động Chỉ Số -->
        <div class="fh-chart-insight-box">
          <div class="fh-cib-header">
            <div class="fh-cib-icon"><i class="fi fi-rr-chart-line-up"></i></div>
            <h5 class="fh-cib-title">Phân Tích Biến Động Chỉ Số Thực Tế</h5>
          </div>
          <p class="fh-cib-text">${trendAnalysisText}</p>
        </div>
      `;

      chartContentHtml = `
        <div class="fh-chart-main-card">
          <!-- Card Header & Legend -->
          <div class="fh-chart-card-header">
            <div class="fh-chart-card-title-box">
              <h4 class="fh-chart-card-title">
                ${metric === 'weight' ? 'Đường Cong Cân Nặng' : (metric === 'height' ? 'Đường Cong Chiều Cao' : 'Đường Cong Chỉ Số BMI')}
              </h4>
              <span class="fh-chart-standard-badge">
                <i class="fi fi-rr-shield-check"></i> <span>${standardTitle}</span>
              </span>
            </div>

            <!-- Chú thích Legend -->
            <div class="fh-chart-legend">
              <div class="fh-legend-item">
                <span class="fh-legend-swatch fh-legend-band"></span>
                <span>Vùng đạt chuẩn</span>
              </div>
              <div class="fh-legend-item">
                <span class="fh-legend-swatch fh-legend-median"></span>
                <span>Trung vị chuẩn (Median)</span>
              </div>
              <div class="fh-legend-item">
                <span class="fh-legend-swatch fh-legend-actual"></span>
                <span>Số đo thực tế</span>
              </div>
            </div>
          </div>

          <!-- SVG Graphic -->
          ${svgChartHtml}
        </div>

        <!-- Insights & Details -->
        ${insightCardHtml}
      `;
    }

    container.innerHTML = `
      <div class="fh-chart-layout">
        <!-- Top Controls: Thành viên + Bộ chọn metric -->
        <div class="fh-chart-top-toolbar">
          <div class="fh-chart-member-scroll-wrap">
            <div class="fh-chart-member-list">
              ${memberSelectorHtml}
            </div>
          </div>
          ${metricButtonsHtml}
        </div>

        <!-- Main Chart & Insights Area -->
        <div class="fh-chart-body-area">
          ${chartContentHtml}
        </div>

        <!-- Bottom Action Bar -->
        <div class="fh-chart-bottom-actions">
          <button type="button" class="fh-btn fh-btn-secondary" onclick="window.fhViewMemberHistory('${currentMember.id}')">
            <i class="fi fi-rr-time-past"></i> <span>Xem Lịch Sử Đo Của ${escapeHtml(currentMember.name)}</span>
          </button>
          <button type="button" class="fh-btn fh-btn-primary" onclick="window.fhOpenAddLogModal('${currentMember.id}')">
            <i class="fi fi-rr-plus"></i> <span>Ghi Thêm Số Đo Mới</span>
          </button>
        </div>
      </div>
    `;
  }

  // 3. Tab 3: Lịch sử & Nhật ký đo (History)
  function renderHistoryTab() {
    const container = document.getElementById('fhTabContent');
    if (!container) return;

    let filteredLogs = [...state.logs];
    if (state.selectedMemberIdForHistory !== 'all') {
      filteredLogs = filteredLogs.filter(l => l.memberId === state.selectedMemberIdForHistory);
    }
    filteredLogs.sort((a, b) => new Date(b.measuredDate) - new Date(a.measuredDate));

    const memberFilterOptions = [
      `<option value="all" ${state.selectedMemberIdForHistory === 'all' ? 'selected' : ''}>Tất cả thành viên (${state.members.length})</option>`,
      ...state.members.map(m => `
        <option value="${m.id}" ${state.selectedMemberIdForHistory === m.id ? 'selected' : ''}>
          ${escapeHtml(m.name)} (${escapeHtml(m.role)})
        </option>
      `)
    ].join('');

    if (filteredLogs.length === 0) {
      container.innerHTML = `
        <div class="fh-history-toolbar">
          <div class="fh-filter-wrap">
            <label><i class="fi fi-rr-filter"></i> Lọc theo:</label>
            <select class="fh-select" onchange="window.fhOnHistoryFilterChange(this.value)">
              ${memberFilterOptions}
            </select>
          </div>
          <button type="button" class="fh-btn fh-btn-primary" onclick="window.fhOpenAddLogModal()">
            <i class="fi fi-rr-plus"></i> <span>Ghi Số Đo Mới</span>
          </button>
        </div>
        <div class="fh-empty-state">
          <div class="fh-empty-icon"><i class="fi fi-rr-document"></i></div>
          <h4 class="fh-empty-title">Chưa có lịch sử đo lường</h4>
          <p class="fh-empty-desc">Hãy ghi nhận các lần cân đo chiều cao, cân nặng định kỳ để theo dõi đà phát triển!</p>
        </div>
      `;
      return;
    }

    const tableRowsHtml = filteredLogs.map((log, index) => {
      const member = state.members.find(m => m.id === log.memberId) || {
        name: 'Thành viên đã xóa',
        role: '---',
        gender: 'male',
        birthDate: '2000-01-01'
      };

      const evalData = evaluateHealthStatus(
        log.heightCm,
        log.weightKg,
        member.birthDate,
        member.gender,
        log.measuredDate
      );

      return `
        <tr>
          <td class="fh-td-date">
            <span class="fh-td-date-badge">
              <i class="fi fi-rr-calendar"></i>
              <span>${formatDateVi(log.measuredDate)}</span>
            </span>
          </td>
          <td class="fh-td-member">
            <div class="fh-table-member-cell">
              <strong>${escapeHtml(member.name)}</strong>
              <small>${escapeHtml(member.role)}</small>
            </div>
          </td>
          <td class="fh-td-num"><strong>${log.heightCm}</strong> cm</td>
          <td class="fh-td-num"><strong>${log.weightKg}</strong> kg</td>
          <td class="fh-td-bmi">
            <span class="fh-bmi-badge">${evalData.bmi}</span>
          </td>
          <td class="fh-td-status">
            <span class="fh-status-tag ${evalData.statusClass}">
              ${evalData.statusLabel}
            </span>
          </td>
          <td class="fh-td-notes">
            <span class="fh-notes-text">${escapeHtml(log.notes || '---')}</span>
          </td>
          <td class="fh-td-actions">
            <button type="button" class="fh-icon-btn fh-icon-btn-danger" onclick="window.fhDeleteLog('${log.id}')" title="Xóa bản ghi này">
              <i class="fi fi-rr-trash"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    const mobileCardsHtml = filteredLogs.map((log) => {
      const member = state.members.find(m => m.id === log.memberId) || {
        name: 'Thành viên đã xóa',
        role: '---',
        gender: 'male',
        birthDate: '2000-01-01'
      };

      const evalData = evaluateHealthStatus(
        log.heightCm,
        log.weightKg,
        member.birthDate,
        member.gender,
        log.measuredDate
      );

      return `
        <div class="fh-history-card-item">
          <div class="fh-hci-top">
            <div class="fh-hci-member">
              <strong>${escapeHtml(member.name)}</strong>
              <span class="fh-member-role-badge">${escapeHtml(member.role)}</span>
            </div>
            <div class="fh-hci-date-actions">
              <span class="fh-hci-date"><i class="fi fi-rr-calendar"></i> <span>${formatDateVi(log.measuredDate)}</span></span>
              <button type="button" class="fh-icon-btn fh-icon-btn-danger fh-btn-sm" onclick="window.fhDeleteLog('${log.id}')" title="Xóa">
                <i class="fi fi-rr-trash"></i>
              </button>
            </div>
          </div>
          <div class="fh-hci-stats">
            <div class="fh-hci-stat-col">
              <span class="fh-hci-stat-lbl">Chiều cao</span>
              <span class="fh-hci-stat-val">${log.heightCm} <small>cm</small></span>
            </div>
            <div class="fh-hci-stat-col">
              <span class="fh-hci-stat-lbl">Cân nặng</span>
              <span class="fh-hci-stat-val">${log.weightKg} <small>kg</small></span>
            </div>
            <div class="fh-hci-stat-col">
              <span class="fh-hci-stat-lbl">BMI</span>
              <span class="fh-hci-stat-val ${evalData.statusClass}-text">${evalData.bmi}</span>
            </div>
          </div>
          <div class="fh-hci-bottom">
            <span class="fh-status-tag ${evalData.statusClass}">${evalData.statusLabel}</span>
            ${log.notes ? `<span class="fh-hci-note"><i class="fi fi-rr-comment-alt"></i> <span>${escapeHtml(log.notes)}</span></span>` : ''}
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="fh-history-toolbar">
        <div class="fh-filter-wrap">
          <label><i class="fi fi-rr-filter"></i> Lọc thành viên:</label>
          <select class="fh-select" onchange="window.fhOnHistoryFilterChange(this.value)">
            ${memberFilterOptions}
          </select>
        </div>
        <div class="fh-toolbar-actions">
          <button type="button" class="fh-btn fh-btn-primary" onclick="window.fhOpenAddLogModal()">
            <i class="fi fi-rr-plus"></i> <span>Ghi Số Đo Mới</span>
          </button>
        </div>
      </div>

      <!-- Desktop Table View -->
      <div class="fh-table-responsive fh-desktop-only">
        <table class="fh-table">
          <thead>
            <tr>
              <th>Ngày đo</th>
              <th>Thành viên</th>
              <th>Chiều cao</th>
              <th>Cân nặng</th>
              <th>BMI</th>
              <th>Đánh giá thể trạng</th>
              <th>Ghi chú</th>
              <th style="text-align: right;">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>
      </div>

      <!-- Mobile Cards List View -->
      <div class="fh-history-cards-mobile fh-mobile-only">
        ${mobileCardsHtml}
      </div>
    `;
  }

  // 3. Tab 3: Máy tính đo nhanh (Interactive Live Calculator)
  function renderCalculatorTab() {
    const container = document.getElementById('fhTabContent');
    if (!container) return;

    container.innerHTML = `
      <div class="fh-calc-layout">
        <!-- Input Form Side -->
        <div class="fh-calc-form-card">
          <div class="fh-calc-card-header">
            <div class="fh-calc-header-icon"><i class="fi fi-rr-calculator"></i></div>
            <div>
              <h4 class="fh-calc-title">Máy Tính Thể Trạng Nhanh</h4>
              <p class="fh-calc-desc">Nhập nhanh thông số để tra cứu chuẩn WHO từng tháng tuổi cho bé hoặc chuẩn BMI người lớn</p>
            </div>
          </div>

          <form id="fhQuickCalcForm" class="fh-form" onsubmit="event.preventDefault(); window.fhDoQuickCalculate();">
            <!-- Nhóm chọn đối tượng -->
            <div class="fh-form-group">
              <label class="fh-form-label">Đối tượng kiểm tra:</label>
              <div class="fh-radio-pills">
                <label class="fh-radio-pill">
                  <input type="radio" name="calcTargetType" value="adult" checked onchange="window.fhOnCalcTypeChange('adult')">
                  <span><i class="fi fi-rr-user"></i> <span>Người lớn (≥ 19t)</span></span>
                </label>
                <label class="fh-radio-pill">
                  <input type="radio" name="calcTargetType" value="baby" onchange="window.fhOnCalcTypeChange('baby')">
                  <span><i class="fi fi-rr-baby"></i> <span>Bé nhỏ (0 - 36 tháng)</span></span>
                </label>
                <label class="fh-radio-pill">
                  <input type="radio" name="calcTargetType" value="child" onchange="window.fhOnCalcTypeChange('child')">
                  <span><i class="fi fi-rr-smile"></i> <span>Trẻ em (3 - 18t)</span></span>
                </label>
              </div>
            </div>

            <!-- Giới tính -->
            <div class="fh-form-group">
              <label class="fh-form-label">Giới tính:</label>
              <div class="fh-radio-pills">
                <label class="fh-radio-pill">
                  <input type="radio" name="calcGender" value="male" checked onchange="window.fhOnQuickGenderChange('male')">
                  <span><i class="fi fi-rr-mars"></i> <span>Nam / Bé trai</span></span>
                </label>
                <label class="fh-radio-pill">
                  <input type="radio" name="calcGender" value="female" onchange="window.fhOnQuickGenderChange('female')">
                  <span><i class="fi fi-rr-venus"></i> <span>Nữ / Bé gái</span></span>
                </label>
              </div>
            </div>

            <!-- Tháng tuổi của bé (chỉ hiện khi chọn Bé nhỏ 0 - 36 tháng) -->
            <div class="fh-form-group" id="fhCalcAgeGroupBaby" style="display: none;">
              <label class="fh-form-label" for="calcAgeMonths">
                <span>Tháng tuổi của bé (từ 0 đến 36 tháng):</span>
                <small style="font-weight: normal; color: #38bdf8; margin-left: 6px;">(Tự gợi ý chuẩn WHO khi đổi tháng)</small>
              </label>
              <div class="fh-input-with-unit">
                <input type="number" id="calcAgeMonths" class="fh-input" min="0" max="36" value="14" oninput="window.fhOnBabyMonthInput()" />
                <span class="fh-unit">tháng tuổi</span>
              </div>
            </div>

            <!-- Tuổi của trẻ lớn (chỉ hiện khi chọn Trẻ em 3 - 18 tuổi) -->
            <div class="fh-form-group" id="fhCalcAgeGroupChild" style="display: none;">
              <label class="fh-form-label" for="calcAgeYears">Tuổi của bé (từ 3 đến 18 tuổi):</label>
              <div class="fh-input-with-unit">
                <input type="number" id="calcAgeYears" class="fh-input" min="3" max="18" value="7" oninput="window.fhDoQuickCalculate()" />
                <span class="fh-unit">tuổi</span>
              </div>
            </div>

            <!-- Chiều cao & Cân nặng -->
            <div class="fh-form-row">
              <div class="fh-form-group fh-col-6">
                <label class="fh-form-label" for="calcHeight">Chiều cao / Chiều dài:</label>
                <div class="fh-input-with-unit">
                  <input type="number" id="calcHeight" class="fh-input" step="0.5" min="40" max="230" value="168" oninput="window.fhDoQuickCalculate()" required />
                  <span class="fh-unit">cm</span>
                </div>
              </div>

              <div class="fh-form-group fh-col-6">
                <label class="fh-form-label" for="calcWeight">Cân nặng:</label>
                <div class="fh-input-with-unit">
                  <input type="number" id="calcWeight" class="fh-input" step="0.1" min="2" max="200" value="62.5" oninput="window.fhDoQuickCalculate()" required />
                  <span class="fh-unit">kg</span>
                </div>
              </div>
            </div>

            <div class="fh-form-actions">
              <button type="button" class="fh-btn fh-btn-secondary" onclick="window.fhResetQuickCalc()">
                <i class="fi fi-rr-refresh"></i> <span>Đặt lại</span>
              </button>
              <button type="submit" class="fh-btn fh-btn-primary">
                <i class="fi fi-rr-chart-pie"></i> <span>Tính Ngay</span>
              </button>
            </div>
          </form>
        </div>

        <!-- Result Card Side -->
        <div class="fh-calc-result-card" id="fhCalcResultCard">
          <!-- Rendered dynamically by fhDoQuickCalculate() -->
        </div>
      </div>
    `;

    // Tính toán mẫu ngay lần đầu mở tab
    fhDoQuickCalculate();
  }

  // --- HÀM XỬ LÝ QUICK CALCULATOR ---
  function fhOnCalcTypeChange(type) {
    const ageGroupBaby = document.getElementById('fhCalcAgeGroupBaby');
    const ageGroupChild = document.getElementById('fhCalcAgeGroupChild');
    const heightInput = document.getElementById('calcHeight');
    const weightInput = document.getElementById('calcWeight');
    const gender = document.querySelector('input[name="calcGender"]:checked')?.value || 'male';

    if (ageGroupBaby) ageGroupBaby.style.display = type === 'baby' ? 'block' : 'none';
    if (ageGroupChild) ageGroupChild.style.display = type === 'child' ? 'block' : 'none';

    // Gợi ý số đo mặc định hợp lý cho từng nhóm
    if (type === 'baby') {
      const months = parseInt(document.getElementById('calcAgeMonths')?.value, 10) || 14;
      const refW = getWhoChildRef(gender, months, 'weight');
      const refH = getWhoChildRef(gender, months, 'height');
      if (heightInput) heightInput.value = refH ? refH.median : 78.0;
      if (weightInput) weightInput.value = refW ? refW.median : 10.1;
    } else if (type === 'child') {
      if (heightInput) heightInput.value = '122';
      if (weightInput) weightInput.value = '23.0';
    } else {
      if (heightInput) heightInput.value = '168';
      if (weightInput) weightInput.value = '62.5';
    }

    fhDoQuickCalculate();
  }

  function fhOnBabyMonthInput() {
    const monthsInput = document.getElementById('calcAgeMonths');
    if (!monthsInput) return;
    const months = parseInt(monthsInput.value, 10);
    const gender = document.querySelector('input[name="calcGender"]:checked')?.value || 'male';

    if (!isNaN(months) && months >= 0 && months <= 36) {
      const refW = getWhoChildRef(gender, months, 'weight');
      const refH = getWhoChildRef(gender, months, 'height');
      const heightInput = document.getElementById('calcHeight');
      const weightInput = document.getElementById('calcWeight');
      if (refH && heightInput) heightInput.value = refH.median;
      if (refW && weightInput) weightInput.value = refW.median;
    }
    fhDoQuickCalculate();
  }

  function fhOnQuickGenderChange(gender) {
    const targetType = document.querySelector('input[name="calcTargetType"]:checked')?.value || 'adult';
    if (targetType === 'baby') {
      const months = parseInt(document.getElementById('calcAgeMonths')?.value, 10) || 14;
      const refW = getWhoChildRef(gender, months, 'weight');
      const refH = getWhoChildRef(gender, months, 'height');
      const heightInput = document.getElementById('calcHeight');
      const weightInput = document.getElementById('calcWeight');
      if (refH && heightInput) heightInput.value = refH.median;
      if (refW && weightInput) weightInput.value = refW.median;
    }
    fhDoQuickCalculate();
  }

  function fhDoQuickCalculate() {
    const form = document.getElementById('fhQuickCalcForm');
    const resultBox = document.getElementById('fhCalcResultCard');
    if (!form || !resultBox) return;

    const targetType = form.calcTargetType.value;
    const gender = form.calcGender.value;
    const height = parseFloat(document.getElementById('calcHeight').value);
    const weight = parseFloat(document.getElementById('calcWeight').value);

    if (!height || !weight || height <= 0 || weight <= 0) {
      resultBox.innerHTML = `
        <div class="fh-calc-placeholder">
          <i class="fi fi-rr-scale"></i>
          <span>Vui lòng nhập chiều cao và cân nặng hợp lệ</span>
        </div>
      `;
      return;
    }

    let fakeBirthDate = '1995-01-01'; // Default adult
    const now = new Date();
    if (targetType === 'baby') {
      const babyMonths = parseInt(document.getElementById('calcAgeMonths')?.value, 10) || 14;
      const birthD = new Date(now.getFullYear(), now.getMonth() - babyMonths, now.getDate());
      fakeBirthDate = birthD.toISOString().slice(0, 10);
    } else if (targetType === 'child') {
      const childAge = parseInt(document.getElementById('calcAgeYears')?.value, 10) || 7;
      fakeBirthDate = `${now.getFullYear() - childAge}-01-01`;
    }

    const evalData = evaluateHealthStatus(height, weight, fakeBirthDate, gender, null);

    // Xử lý hiển thị riêng cho Trẻ nhỏ <= 36 tháng tuổi
    if (evalData.isUnder36M) {
      const refW = evalData.refWeight || getWhoChildRef(gender, evalData.months, 'weight');
      const refH = evalData.refHeight || getWhoChildRef(gender, evalData.months, 'height');

      resultBox.innerHTML = `
        <div class="fh-result-header">
          <div class="fh-result-badge-top ${evalData.statusClass}">
            <i class="fi ${evalData.status === 'normal' ? 'fi-rr-check-circle' : 'fi-rr-info'}"></i>
            <span>${evalData.statusLabel}</span>
          </div>
          <span class="fh-standard-tag">${evalData.standardName}</span>
        </div>

        <!-- Thẻ tóm tắt các chỉ số chính của bé theo chuẩn WHO tháng -->
        <div class="fh-cdc-metrics-grid" style="margin-top: 14px; margin-bottom: 16px;">
          <div class="fh-cdc-item">
            <span class="fh-cdc-lbl">Cân nặng bé</span>
            <span class="fh-cdc-val" style="color: #38bdf8;">${weight} <small>kg</small></span>
            <span style="font-size: 0.72rem; color: #94a3b8; margin-top: 2px;">Chuẩn: ${refW.sdMinus2} - ${refW.sdPlus2} kg</span>
          </div>
          <div class="fh-cdc-item">
            <span class="fh-cdc-lbl">Chiều cao bé</span>
            <span class="fh-cdc-val" style="color: #38bdf8;">${height} <small>cm</small></span>
            <span style="font-size: 0.72rem; color: #94a3b8; margin-top: 2px;">Chuẩn: ${refH.sdMinus2} - ${refH.sdPlus2} cm</span>
          </div>
          <div class="fh-cdc-item">
            <span class="fh-cdc-lbl">Trung vị cân nặng</span>
            <span class="fh-cdc-val" style="color: #34d399;">${refW.median} <small>kg</small></span>
            <span style="font-size: 0.72rem; color: #94a3b8; margin-top: 2px;">(Median 50th)</span>
          </div>
          <div class="fh-cdc-item">
            <span class="fh-cdc-lbl">So với trung vị</span>
            <span class="fh-cdc-val ${evalData.diffText.includes('+') ? 'text-emerald-400' : 'text-sky-400'}">
              ${evalData.diffText}
            </span>
          </div>
        </div>

        <!-- Thông tin chuẩn tham chiếu theo tháng tuổi -->
        <div class="fh-result-recommendations">
          <div class="fh-rec-item">
            <i class="fi fi-rr-target"></i>
            <div>
              <strong>Dải cân nặng chuẩn WHO tháng tuổi này:</strong>
              <p><strong>${refW.sdMinus2} - ${refW.sdPlus2} kg</strong> (Mốc trung vị lý tưởng: <strong>${refW.median} kg</strong>)</p>
            </div>
          </div>

          <div class="fh-rec-item">
            <i class="fi fi-rr-ruler-triangle"></i>
            <div>
              <strong>Dải chiều dài/chiều cao chuẩn WHO:</strong>
              <p><strong>${refH.sdMinus2} - ${refH.sdPlus2} cm</strong> (Mốc trung vị lý tưởng: <strong>${refH.median} cm</strong>)</p>
            </div>
          </div>
        </div>
      `;
      return;
    }

    // Hiển thị chuẩn BMI Thước đo (Gauge) cho Người lớn & Trẻ lớn
    const minScale = 15;
    const maxScale = 35;
    const clampBmi = Math.max(minScale, Math.min(maxScale, evalData.bmi));
    const pointerPercent = ((clampBmi - minScale) / (maxScale - minScale)) * 100;

    resultBox.innerHTML = `
      <div class="fh-result-header">
        <div class="fh-result-badge-top ${evalData.statusClass}">
          <i class="fi ${evalData.status === 'normal' ? 'fi-rr-check-circle' : 'fi-rr-info'}"></i>
          <span>${evalData.statusLabel}</span>
        </div>
        <span class="fh-standard-tag">${evalData.standardName}</span>
      </div>

      <!-- BMI Big Number Display -->
      <div class="fh-result-big-display">
        <span class="fh-big-label">Chỉ số BMI của bạn</span>
        <div class="fh-big-val ${evalData.statusClass}-text">${evalData.bmi}</div>
        <div class="fh-big-diff">${evalData.diffText}</div>
      </div>

      <!-- Thước đo trực quan (BMI Visual Gauge) -->
      <div class="fh-bmi-gauge-wrap">
        <div class="fh-bmi-scale-bar">
          <div class="fh-scale-seg fh-seg-under" title="Thiếu cân (< 18.5)"></div>
          <div class="fh-scale-seg fh-seg-normal" title="Chuẩn lý tưởng (18.5 - 22.9)"></div>
          <div class="fh-scale-seg fh-seg-over" title="Thừa cân (23.0 - 24.9)"></div>
          <div class="fh-scale-seg fh-seg-obese" title="Béo phì (≥ 25.0)"></div>
        </div>
        <div class="fh-bmi-pointer" style="left: ${pointerPercent}%;">
          <div class="fh-pointer-arrow"></div>
          <span class="fh-pointer-val">${evalData.bmi}</span>
        </div>
        <div class="fh-gauge-labels">
          <span>15 (Gầy)</span>
          <span>18.5</span>
          <span>23.0 (Chuẩn)</span>
          <span>25.0</span>
          <span>35+ (Béo phì)</span>
        </div>
      </div>

      <!-- Thông tin chuẩn tham chiếu -->
      <div class="fh-result-recommendations">
        <div class="fh-rec-item">
          <i class="fi fi-rr-target"></i>
          <div>
            <strong>Mức cân nặng chuẩn nên duy trì:</strong>
            <p>${evalData.idealRangeText} (theo chiều cao ${height} cm)</p>
          </div>
        </div>
      </div>
    `;
  }

  function fhResetQuickCalc() {
    const form = document.getElementById('fhQuickCalcForm');
    if (form) {
      form.reset();
      fhOnCalcTypeChange('adult');
    }
  }

  // --- MODAL THÊM / SỬA THÀNH VIÊN ---
  function openAddMemberModal(memberId = null) {
    state.activeEditingMemberId = memberId;
    const modal = document.getElementById('fhMemberModal');
    const titleEl = document.getElementById('fhMemberModalTitle');
    const form = document.getElementById('fhMemberForm');
    if (!modal || !form) return;

    if (memberId) {
      const member = state.members.find(m => m.id === memberId);
      if (!member) return;
      if (titleEl) titleEl.innerText = 'Chỉnh Sửa Hồ Sơ Thành Viên';
      form.memberName.value = member.name || '';
      form.memberRole.value = member.role || 'Bố';
      form.memberGender.value = member.gender || 'male';
      form.memberBirthDate.value = member.birthDate || '1990-01-01';
      form.memberNote.value = member.note || '';
    } else {
      if (titleEl) titleEl.innerText = 'Thêm Thành Viên Mới';
      form.reset();
      form.memberBirthDate.value = '1990-01-01';
      form.memberGender.value = 'male';
      form.memberRole.value = 'Con trai';
    }

    modal.style.display = 'flex';
    modal.classList.add('active');
  }

  function closeMemberModal() {
    const modal = document.getElementById('fhMemberModal');
    if (modal) {
      modal.style.display = 'none';
      modal.classList.remove('active');
    }
    state.activeEditingMemberId = null;
  }

  function handleSaveMemberForm(e) {
    e.preventDefault();
    const form = document.getElementById('fhMemberForm');
    if (!form) return;

    const name = form.memberName.value.trim();
    const role = form.memberRole.value.trim();
    const gender = form.memberGender.value;
    const birthDate = form.memberBirthDate.value;
    const note = form.memberNote.value.trim();

    if (!name || !birthDate) {
      alert('Vui lòng nhập tên và ngày sinh của thành viên');
      return;
    }

    // Chọn avatar icon và màu tương ứng vai trò
    let avatarIcon = 'fi-rr-user';
    let avatarColor = 'linear-gradient(135deg, #10b981, #059669)';
    if (role.includes('Bố') || role.includes('Ông')) {
      avatarIcon = 'fi-rr-user';
      avatarColor = 'linear-gradient(135deg, #3b82f6, #1d4ed8)';
    } else if (role.includes('Mẹ') || role.includes('Bà')) {
      avatarIcon = 'fi-rr-heart';
      avatarColor = 'linear-gradient(135deg, #ec4899, #be185d)';
    } else if (role.includes('Con gái')) {
      avatarIcon = 'fi-rr-flower';
      avatarColor = 'linear-gradient(135deg, #f59e0b, #d97706)';
    } else if (role.includes('Con trai')) {
      avatarIcon = 'fi-rr-smile';
      avatarColor = 'linear-gradient(135deg, #06b6d4, #0891b2)';
    }

    if (state.activeEditingMemberId) {
      // Cập nhật
      const index = state.members.findIndex(m => m.id === state.activeEditingMemberId);
      if (index !== -1) {
        state.members[index] = {
          ...state.members[index],
          name,
          role,
          gender,
          birthDate,
          note,
          avatarIcon,
          avatarColor
        };
      }
    } else {
      // Thêm mới
      const newMember = {
        id: 'mem_' + Date.now(),
        name,
        role,
        gender,
        birthDate,
        note,
        avatarIcon,
        avatarColor,
        createdAt: new Date().toISOString()
      };
      state.members.push(newMember);
    }

    saveMembers();
    closeMemberModal();
    renderCurrentTab();
  }

  // --- MODAL GHI SỐ ĐO MỚI ---
  function openAddLogModal(presetMemberId = null) {
    const modal = document.getElementById('fhLogModal');
    const form = document.getElementById('fhLogForm');
    const selectMember = document.getElementById('logMemberSelect');
    if (!modal || !form || !selectMember) return;

    if (state.members.length === 0) {
      alert('Vui lòng thêm thành viên trước khi ghi số đo');
      openAddMemberModal();
      return;
    }

    // Populate dropdown thành viên
    selectMember.innerHTML = state.members.map(m => `
      <option value="${m.id}" ${presetMemberId === m.id ? 'selected' : ''}>
        ${escapeHtml(m.name)} (${escapeHtml(m.role)})
      </option>
    `).join('');

    // Thiết lập ngày đo mặc định là hôm nay
    const today = new Date().toISOString().split('T')[0];
    form.logMeasuredDate.value = today;

    // Điền số đo cũ (nếu có) để người dùng tiện chỉnh sửa
    const targetMemberId = presetMemberId || state.members[0].id;
    const latest = getLatestLog(targetMemberId);
    if (latest) {
      form.logHeight.value = latest.heightCm;
      form.logWeight.value = latest.weightKg;
    } else {
      form.logHeight.value = '165';
      form.logWeight.value = '55';
    }
    form.logNotes.value = '';

    modal.style.display = 'flex';
    modal.classList.add('active');
  }

  function closeLogModal() {
    const modal = document.getElementById('fhLogModal');
    if (modal) {
      modal.style.display = 'none';
      modal.classList.remove('active');
    }
  }

  function handleSaveLogForm(e) {
    e.preventDefault();
    const form = document.getElementById('fhLogForm');
    if (!form) return;

    const memberId = form.logMemberSelect.value;
    const measuredDate = form.logMeasuredDate.value;
    const heightCm = parseFloat(form.logHeight.value);
    const weightKg = parseFloat(form.logWeight.value);
    const notes = form.logNotes.value.trim();

    if (!memberId || !measuredDate || isNaN(heightCm) || isNaN(weightKg)) {
      alert('Vui lòng điền đầy đủ chiều cao và cân nặng hợp lệ');
      return;
    }

    const newLog = {
      id: 'log_' + Date.now(),
      memberId,
      measuredDate,
      heightCm,
      weightKg,
      notes
    };

    state.logs.push(newLog);
    saveLogs();
    closeLogModal();
    renderCurrentTab();
  }

  function deleteLog(logId) {
    if (!confirm('Bạn có chắc muốn xóa bản ghi đo này?')) return;
    state.logs = state.logs.filter(l => l.id !== logId);
    saveLogs();
    renderCurrentTab();
  }

  // --- ĐIỀU HƯỚNG TABS ---
  function switchHealthTab(tabName) {
    state.currentTab = tabName;
    document.querySelectorAll('.fh-nav-tabs .fh-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });
    renderCurrentTab();
  }

  function renderCurrentTab() {
    if (state.currentTab === 'overview') {
      renderOverviewTab();
    } else if (state.currentTab === 'chart') {
      renderChartTab();
    } else if (state.currentTab === 'history') {
      renderHistoryTab();
    } else if (state.currentTab === 'calculator') {
      renderCalculatorTab();
    }
  }

  // --- MỞ / ĐÓNG MODAL CHÍNH ---
  function openFamilyHealthModal() {
    if (!firebaseHealthMembersRef && window.firebaseDb && window.userProfileKey) {
      initFamilyHealthFirebase(window.firebaseDb, window.userProfileKey);
    }
    if (state.members.length === 0 && state.logs.length === 0) {
      loadData();
    }
    const modal = document.getElementById('familyHealthModal');
    if (modal) {
      modal.style.display = 'flex';
      switchHealthTab(state.currentTab || 'overview');
    }
  }

  function closeFamilyHealthModal() {
    const modal = document.getElementById('familyHealthModal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  // Tiện ích escape HTML tránh XSS
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- EXPOSE TO WINDOW ---
  window.openFamilyHealthModal = openFamilyHealthModal;
  window.closeFamilyHealthModal = closeFamilyHealthModal;
  window.switchHealthTab = switchHealthTab;
  window.initFamilyHealthFirebase = initFamilyHealthFirebase;
  window.fhOpenAddMemberModal = openAddMemberModal;
  window.fhCloseMemberModal = closeMemberModal;
  window.fhHandleSaveMemberForm = handleSaveMemberForm;
  window.fhEditMember = openAddMemberModal;
  window.fhDeleteMember = deleteMember;
  window.fhOpenAddLogModal = openAddLogModal;
  window.fhCloseLogModal = closeLogModal;
  window.fhHandleSaveLogForm = handleSaveLogForm;
  window.fhDeleteLog = deleteLog;
  window.fhOnHistoryFilterChange = function (val) {
    state.selectedMemberIdForHistory = val;
    renderHistoryTab();
  };
  window.fhViewMemberHistory = function (memberId) {
    state.selectedMemberIdForHistory = memberId;
    switchHealthTab('history');
  };
  window.fhViewMemberChart = function (memberId) {
    state.selectedMemberIdForChart = memberId;
    switchHealthTab('chart');
  };
  window.fhOnChartMemberChange = function (memberId) {
    state.selectedMemberIdForChart = memberId;
    renderChartTab();
  };
  window.fhOnChartMetricChange = function (metricName) {
    state.selectedMetricForChart = metricName;
    renderChartTab();
  };
  window.fhOnCalcTypeChange = fhOnCalcTypeChange;
  window.fhOnBabyMonthInput = fhOnBabyMonthInput;
  window.fhOnQuickGenderChange = fhOnQuickGenderChange;
  window.fhDoQuickCalculate = fhDoQuickCalculate;
  window.fhResetQuickCalc = fhResetQuickCalc;

  // Auto load on init
  document.addEventListener('DOMContentLoaded', () => {
    loadData();
    if (window.firebaseDb && window.userProfileKey) {
      initFamilyHealthFirebase(window.firebaseDb, window.userProfileKey);
    }
  });
})();
