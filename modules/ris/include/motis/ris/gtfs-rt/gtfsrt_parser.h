#pragma once

#include <functional>
#include <string_view>
#include <vector>

#include "motis/ris/ris_message.h"

namespace motis {
struct schedule;
}  // namespace motis

namespace motis::ris::gtfsrt {

struct knowledge_context;

void to_ris_message(schedule const& sched, knowledge_context&,
                    bool is_additional_skip_allowed, std::string_view,
                    std::function<void(ris_message&&)> const&,
                    std::string const& tag = "");

std::vector<ris_message> parse(schedule const& sched, knowledge_context&,
                               bool is_additional_skip_allowed,
                               std::string_view, std::string const& tag = "");

}  // namespace motis::ris::gtfsrt
