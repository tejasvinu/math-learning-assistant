import { ChartConfiguration } from 'chart.js';

export async function getChart(type: string, data: number[], labels: string[]): Promise<ChartConfiguration> {
  return {
    type: type as 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Generated Chart',
          data,
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: true,
        },
      },
    },
  };
}