export const flattenDepartmentOptions = departments => {
  const result = []
  const visit = (items, depth = 0) => {
    ;(items || []).forEach(item => {
      const children = item.children || []
      result.push({ ...item, disabled: children.length > 0, optionLabel: `${'　'.repeat(depth)}${item.name}` })
      visit(children, depth + 1)
    })
  }
  visit(departments)
  return result
}
