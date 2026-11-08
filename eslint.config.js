// @ts-check
import antfu from '@antfu/eslint-config'

export default antfu({
  type: 'lib',
  ignores: ['dist/**', 'example/**', '.omx/**'],
}, {
  rules: {
    'no-console': 'off',
  },
})
