#pragma once

#include <iomanip>
#include <iostream>

#include "motis/path/prepare/post/post_graph.h"

namespace motis::path {

inline void print_post_colors(post_graph const& graph, color_t const color) {
  for (auto i = 0UL; i < graph.segment_ids_.size(); ++i) {
    for (auto const& id : graph.segment_ids_.at(i)) {
      if (id.color_ != color) {
        continue;
      }

      for (auto const& sid : graph.originals_.at(i).station_ids_) {
        std::clog << sid << ".";
      }
      std::clog << std::endl;

      for (auto const& cls : graph.originals_.at(i).classes_) {
        std::clog << cls << ",";
      }
      std::clog << std::endl;
    }
  }
}

inline void print_post_graph(post_graph const& graph) {
  std::clog << "nodes: " << graph.nodes_.size() << std::endl;
  for (auto const& node : graph.nodes_) {
    for (auto const& edge : node->out_) {
      std::clog << "e: " << node->id_.osm_id_ << "("
                << std::setprecision(std::numeric_limits<double>::digits10 + 1)
                << node->id_.pos_.lat_ << ","
                << std::setprecision(std::numeric_limits<double>::digits10 + 1)
                << node->id_.pos_.lng_ << ") -> " << edge.other_->id_.osm_id_
                << "("
                << std::setprecision(std::numeric_limits<double>::digits10 + 1)
                << edge.other_->id_.pos_.lat_ << ","
                << std::setprecision(std::numeric_limits<double>::digits10 + 1)
                << edge.other_->id_.pos_.lng_ << ")\n";
    }
  }
  std::clog << std::endl;
}

}  // namespace motis::path