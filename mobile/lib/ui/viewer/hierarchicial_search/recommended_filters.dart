import "package:flutter/material.dart";
import "package:photos/models/search/hierarchical/hierarchical_search_filter.dart";
import "package:photos/ui/viewer/gallery/state/inherited_search_filter_data.dart";
import "package:photos/ui/viewer/gallery/state/search_filter_data_provider.dart";
import "package:photos/ui/viewer/hierarchicial_search/filter_chip.dart";

class RecommendedFilters extends StatefulWidget {
  const RecommendedFilters({super.key});

  @override
  State<RecommendedFilters> createState() => _RecommendedFiltersState();
}

class _RecommendedFiltersState extends State<RecommendedFilters> {
  late SearchFilterDataProvider _searchFilterDataProvider;
  late List<HierarchicalSearchFilter> _recommendations;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final temp = InheritedSearchFilterData.of(context).searchFilterDataProvider;
    assert(temp != null, "SearchFilterDataProvider is null");
    _searchFilterDataProvider = temp!;
    _recommendations = _searchFilterDataProvider.recommendations;

    _searchFilterDataProvider.removeListener(
      fromRecommended: true,
      listener: onRecommendedFiltersUpdate,
    );
    _searchFilterDataProvider.addListener(
      toRecommended: true,
      listener: onRecommendedFiltersUpdate,
    );
  }

  @override
  void dispose() {
    _searchFilterDataProvider.removeListener(
      fromRecommended: true,
      listener: onRecommendedFiltersUpdate,
    );
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      itemBuilder: (context, index) {
        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: GenericFilterChip(
            label: _recommendations[index].name(),
            onTap: () {
              _searchFilterDataProvider.applyFilters([_recommendations[index]]);
            },
            leadingIcon: _recommendations[index].icon(),
          ),
        );
      },
      scrollDirection: Axis.horizontal,
      itemCount: _recommendations.length,
      padding: const EdgeInsets.symmetric(horizontal: 4),
    );
  }

  void onRecommendedFiltersUpdate() {
    setState(() {
      _recommendations = _searchFilterDataProvider.recommendations;
    });
  }
}
