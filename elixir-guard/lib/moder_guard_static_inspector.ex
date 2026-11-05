
defmodule ModderGuardStaticInspector do
  @suspicious_extensions [
    ".exe",
    ".dll",
    ".bat",
    ".cmd",
    ".ps1",
    ".scr",
    ".msi",
    ".com"
  ]
    @mojibake_markers [
    "ðŸ",
    "Ã",
    "Â",
    "â€",
    "ï»¿",
    "�"
  ]

  def inspect_archive(file_path, package_type) do
    if package_type not in [:geode, :zip] do
      {:error, "Unsupported package type"}
    else
      case :zip.list_dir(String.to_charlist(file_path)) do
        {:ok, entries} ->
          filenames =
            Enum.flat_map(entries, fn
              {:zip_file, name, _info, _comment, _offset, _size} ->
                [List.to_string(name)]

              _ ->
                []
            end)

          {:ok, report} =
            inspect_entries(filenames, package_type)

          {:ok,
           Map.put(report, :archive_directory_checked, true)}

        {:error, _reason} ->
          {:error, "Could not read archive directory"}
      end
    end
  end

  def inspect_entries(entries, package_type) do
    duplicate_findings = find_duplicates(entries)

    entry_findings =
      Enum.flat_map(entries, fn entry ->
        inspect_entry(entry, package_type)
      end)

    findings = duplicate_findings ++ entry_findings

    {:ok, %{
      package_type: package_type,
      entries_inspected: length(entries),
      findings: findings,
      suspicious_entries: length(findings),
      status: if(findings == [], do: "no_warnings", else: "review_required")
    }}
  end

  defp find_duplicates(entries) do
    entries
    |> Enum.map(&String.downcase/1)
    |> Enum.frequencies()
    |> Enum.filter(fn {_filename, count} -> count > 1 end)
    |> Enum.map(fn {filename, count} ->
      %{
        filename: filename,
        reason: "Duplicate filename detected",
        occurrences: count,
        severity: "warning"
      }
    end)
  end

  defp inspect_entry(filename, package_type) do
    normalized =
      String.replace(filename, "\\", "/")

    extension =
      normalized
      |> Path.extname()
      |> String.downcase()

    cond do
      unsafe_path?(normalized) ->
        [%{
          filename: filename,
          reason: "Potentially unsafe archive path",
          severity: "high"
        }]

      extension in @suspicious_extensions ->
        [%{
          filename: filename,
          reason: "Potentially risky executable file type",
          severity: "warning"
        }]

      package_type == :geode and extension == ".zip" ->
        [%{
          filename: filename,
          reason: "Unexpected nested ZIP archive in Geode package",
          severity: "review"
        }]
              mojibake?(filename) ->
        [%{
          filename: filename,
          reason: "Possible filename encoding corruption (mojibake)",
          severity: "info"
        }]

      true ->
        []
    end
  end

  defp unsafe_path?(filename) do
    segments = String.split(filename, "/")

    String.starts_with?(filename, "/") or
      String.starts_with?(filename, "//") or
      Regex.match?(~r/^[a-zA-Z]:/, filename) or
      Enum.any?(segments, &(&1 == ".."))
  end
    defp mojibake?(filename) do
    Enum.any?(@mojibake_markers, fn marker ->
      String.contains?(filename, marker)
    end)
  end
end
