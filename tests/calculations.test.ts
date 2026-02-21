import { describe, it, expect } from 'vitest';
import { calculateBMR, calculateEnergyData } from '../utils/calculations';
import { ActivityLevel, Gender, Goal } from '../types';

describe('calculations', () => {
  it('calculates BMR using Mifflin-St Jeor', () => {
    const bmrMale = calculateBMR({
      gender: Gender.MALE,
      age: 30,
      height: 180,
      weight: 80,
      activityLevel: ActivityLevel.SEDENTARY,
      goal: Goal.MAINTAIN,
    });

    const bmrFemale = calculateBMR({
      gender: Gender.FEMALE,
      age: 30,
      height: 180,
      weight: 80,
      activityLevel: ActivityLevel.SEDENTARY,
      goal: Goal.MAINTAIN,
    });

    expect(bmrMale).toBe(1780);
    expect(bmrFemale).toBe(1614);
  });

  it('derives energy targets with default macros', () => {
    const result = calculateEnergyData({
      gender: Gender.MALE,
      age: 30,
      height: 180,
      weight: 80,
      activityLevel: ActivityLevel.SEDENTARY,
      goal: Goal.MAINTAIN,
    });

    expect(result.bmr).toBe(1780);
    expect(result.tdee).toBe(2136);
    expect(result.targetCalories).toBe(2136);
    expect(result.dailyProtein).toBe(187);
    expect(result.dailyCarbs).toBe(187);
    expect(result.dailyFats).toBe(71);
  });
});
