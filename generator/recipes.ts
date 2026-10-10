import { json } from './minecraft'
import type { GeneratedFile } from './types'

export interface RecipeResult {
  item: string
  count: number
}

export function shapedRecipe(
  id: string,
  ns: string,
  pattern: string[],
  key: Record<string, { item: string }>,
  result: RecipeResult,
): GeneratedFile {
  return {
    path: `recipes/${id}.json`,
    content: json({
      format_version: '1.20.10',
      'minecraft:recipe_shaped': {
        description: { identifier: `${ns}:${id}` },
        tags: ['crafting_table'],
        pattern,
        key,
        result,
      },
    }),
  }
}

export function shapelessRecipe(
  id: string,
  ns: string,
  ingredients: { item: string }[],
  result: RecipeResult,
): GeneratedFile {
  return {
    path: `recipes/${id}.json`,
    content: json({
      format_version: '1.20.10',
      'minecraft:recipe_shapeless': {
        description: { identifier: `${ns}:${id}` },
        tags: ['crafting_table'],
        ingredients,
        result,
      },
    }),
  }
}

export function furnaceRecipe(
  id: string,
  ns: string,
  input: string,
  output: RecipeResult,
): GeneratedFile {
  return {
    path: `recipes/${id}.json`,
    content: json({
      format_version: '1.20.10',
      'minecraft:recipe_furnace': {
        description: { identifier: `${ns}:${id}` },
        tags: ['furnace'],
        input,
        output: `${output.item}`,
      },
    }),
  }
}
