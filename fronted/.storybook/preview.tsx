import '../app/globals.css'
import type { Preview } from '@storybook/react'

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
  },
  decorators: [
    (Story, context) => {
      const isDark = context.globals?.theme === 'dark'
      document.documentElement.classList.toggle('dark', isDark)
      return <Story />
    },
  ],
}

export default preview