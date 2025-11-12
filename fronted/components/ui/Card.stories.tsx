import type { Meta, StoryObj } from '@storybook/react'
import { Card, CardContent, CardHeader, CardTitle } from './card'

const meta: Meta<typeof Card> = {
  title: 'UI/Card',
  component: Card,
}
export default meta
type Story = StoryObj<typeof Card>

export const Default: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>示例卡片</CardTitle>
      </CardHeader>
      <CardContent>
        这里是卡片内容。
      </CardContent>
    </Card>
  ),
}