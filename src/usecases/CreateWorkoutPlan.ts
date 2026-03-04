import { NotFoundError } from "../errors/index.js";
import { WeekDay } from "../generated/prisma/enums.js";
import { prisma } from "../lib/db.js";

interface CreateWorkoutPlanDto {
  userId: string;
  name: string;
  workoutDays: Array<{
    name: string;
    weekDay: WeekDay;
    isRest: boolean;
    estimatedDurationInSeconds: number;
    exercises: Array<{
      order: number;
      name: string;
      sets: number;
      reps: number;
      restTimeInSeconds: number;
    }>;
  }>;
}

export class CreateWorkoutPlan {
  async execute(workoutPlanDto: CreateWorkoutPlanDto) {
    const existingActiveWorkoutPlan = await prisma.workoutPlan.findFirst({
      where: {
        userId: workoutPlanDto.userId,
        isActive: true,
      },
    });

    return prisma.$transaction(async (tx) => {
      if (existingActiveWorkoutPlan) {
        await tx.workoutPlan.update({
          where: { id: existingActiveWorkoutPlan.id },
          data: { isActive: false },
        });
      }

      const workoutPlan = await tx.workoutPlan.create({
        data: {
          name: workoutPlanDto.name,
          userId: workoutPlanDto.userId,
          isActive: true,
          workoutDays: {
            create: workoutPlanDto.workoutDays.map((workoutDay) => ({
              name: workoutDay.name,
              weekDay: workoutDay.weekDay,
              isRest: workoutDay.isRest,
              estimatedDurationInSeconds: workoutDay.estimatedDurationInSeconds,
              exercises: {
                create: workoutDay.exercises.map((exercise) => ({
                  order: exercise.order,
                  name: exercise.name,
                  sets: exercise.sets,
                  reps: exercise.reps,
                  restTimeInSeconds: exercise.restTimeInSeconds,
                })),
              },
            })),
          },
        },
      });

      const result = await tx.workoutPlan.findUnique({
        where: { id: workoutPlan.id },
        include: {
          workoutDays: {
            include: {
              exercises: true,
            },
          },
        },
      });

      if (!result) {
        throw new NotFoundError("Workout plan not found after creation");
      }

      return result;
    });
  }
}
