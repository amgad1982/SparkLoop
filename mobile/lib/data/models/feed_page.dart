import 'post_models.dart';

/// Cursor-paginated response from `GET /api/posts`.
///
/// [nextCursorCreatedAtUtc] and [nextCursorId] are non-null when [hasMore]
/// is true. To fetch the next page the client should pass both back as the
/// `cursorCreatedAtUtc` and `cursorId` query parameters on the next request.
class FeedPageDto {
  final List<PostDto> items;
  final int pageSize;
  final DateTime? nextCursorCreatedAtUtc;
  final String? nextCursorId;
  final bool hasMore;

  const FeedPageDto({
    required this.items,
    required this.pageSize,
    required this.nextCursorCreatedAtUtc,
    required this.nextCursorId,
    required this.hasMore,
  });

  factory FeedPageDto.empty() => const FeedPageDto(
        items: <PostDto>[],
        pageSize: 0,
        nextCursorCreatedAtUtc: null,
        nextCursorId: null,
        hasMore: false,
      );
}
