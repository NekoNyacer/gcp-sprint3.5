import { firstValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { SeededDemoTaskRepository, calculateDistanceMeters } from './seeded-demo-task.repository';

describe('SeededDemoTaskRepository', () => {
  it('only exposes tasks from the selected area', async () => {
    const repository = new SeededDemoTaskRepository();
    const tasks = await firstValueFrom(repository.watchTasks('banqiao'));
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.every((task) => task.areaId === 'banqiao')).toBe(true);
  });

  it('requires an event to be joined before completion', async () => {
    const repository = new SeededDemoTaskRepository();
    const tasks = await firstValueFrom(repository.watchTasks('banqiao'));
    const task = tasks.find((candidate) => candidate.cadence === 'event')!;
    await expect(repository.completeTask(task.taskId, repository.locationFor(task, 'eligible'))).rejects.toThrow('請先參加活動');
  });

  it('completes once and returns the prior inventory on a duplicate attempt', async () => {
    const repository = new SeededDemoTaskRepository();
    const tasks = await firstValueFrom(repository.watchTasks('banqiao'));
    const task = tasks.find((candidate) => candidate.cadence === 'daily')!;
    const location = repository.locationFor(task, 'eligible');
    const first = await repository.completeTask(task.taskId, location);
    const duplicate = await repository.completeTask(task.taskId, location);
    expect(first.inventory).toEqual(duplicate.inventory);
    expect(first.reward).toEqual(task.reward);
  });

  it('distinguishes distance from reported accuracy', async () => {
    const repository = new SeededDemoTaskRepository();
    const task = (await firstValueFrom(repository.watchTasks('banqiao')))[0];
    await expect(repository.completeTask(task.taskId, repository.locationFor(task, 'poor-accuracy'))).rejects.toThrow('定位精確度不足');
    expect(calculateDistanceMeters(repository.locationFor(task, 'eligible'), task.destination)).toBeLessThanOrEqual(10);
  });
});
