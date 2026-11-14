import { StandardSchemaValidationPipe, UnprocessableEntityException } from '@nestjs/common';

type Issue = Parameters<
  NonNullable<
    ConstructorParameters<typeof StandardSchemaValidationPipe>[0]
  >['exceptionFactory'] & {}
>[0][number];

function pathOf(issue: Issue): string {
  return (issue.path ?? [])
    .map((segment) => String(typeof segment === 'object' ? segment.key : segment))
    .join('.');
}

/**
 * Global pipe: any `@Body({ schema })`, `@Query({ schema })` or `@Param(name, { schema })`
 * is validated and replaced by the schema's parsed output. Failures become a
 * 422 with per-field details in the shared error envelope.
 */
export function createValidationPipe(): StandardSchemaValidationPipe {
  return new StandardSchemaValidationPipe({
    exceptionFactory: (issues) =>
      new UnprocessableEntityException({
        message: 'Some of the information provided is not valid.',
        details: issues.map((issue) => ({ path: pathOf(issue), message: issue.message })),
      }),
  });
}
