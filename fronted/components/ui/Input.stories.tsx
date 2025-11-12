import type { Meta, StoryObj } from '@storybook/react'
import { Input } from './input'

const meta: Meta<typeof Input> = {
  title: 'UI/Input',
  component: Input,
}
export default meta
type Story = StoryObj<typeof Input>

export const Default: Story = {
  args: { placeholder: '输入内容…' },
}
export const Password: Story = {
  args: { type: 'password', placeholder: '••••••' },
}