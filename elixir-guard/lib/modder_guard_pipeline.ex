
defmodule ModderGuardPipeline do
  def inspect_and_scan(file_path) do
    case ModderGuardInspector.inspect_file(file_path) do
      {:ok, file_info} ->
        inspect_static_contents(file_path, file_info)

      {:error, reason} ->
        {:error, %{
          status: "validation_failed",
          reason: reason,
          authorised: false
        }}
    end
  end

  defp inspect_static_contents(file_path, file_info) do
    package_type =
      case String.downcase(Path.extname(file_path)) do
        ".geode" -> :geode
        ".zip" -> :zip
      end

    case ModderGuardStaticInspector.inspect_archive(
           file_path,
           package_type
         ) do
      {:ok, static_report} ->
        run_defender_scan(file_path, file_info, static_report)

      {:error, reason} ->
        {:error, %{
          status: "static_inspection_failed",
          reason: reason,
          file: file_info,
          authorised: false
        }}
    end
  end

  defp run_defender_scan(file_path, file_info, static_report) do
    case ModderGuardDefender.scan_file(file_path) do
      {:ok, defender_result} ->
        status =
          if static_report.suspicious_entries > 0 do
            "review_required"
          else
            "pending_moderation"
          end

        {:ok, %{
          status: status,
          file: file_info,
          static_inspection: static_report,
          antivirus: defender_result,
          authorised: false
        }}

      {:error, defender_result} ->
        {:error, %{
          status: "scan_inconclusive",
          file: file_info,
          static_inspection: static_report,
          antivirus: defender_result,
          authorised: false
        }}
    end
  end
end
